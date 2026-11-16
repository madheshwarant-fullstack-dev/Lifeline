"""
Real-time WebSocket connection manager and privacy-aware event dispatcher.

Manages authenticated WebSocket connections grouped by user ID and role, bridging
synchronous PyMongo/FastAPI worker routes onto the main asyncio event loop safely.
"""

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Set
from fastapi import WebSocket


@dataclass
class ConnectedClient:
    websocket: WebSocket
    user_id: str
    role: str
    email: str = ""
    hospital_id: Optional[str] = None


class ConnectionManager:
    """Tracks authenticated WebSocket clients and dispatches scoped real-time events."""

    def __init__(self) -> None:
        self._clients: Dict[WebSocket, ConnectedClient] = {}
        self._by_user: Dict[str, Set[WebSocket]] = {}
        self._by_role: Dict[str, Set[WebSocket]] = {}
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def set_loop(self, loop: Optional[asyncio.AbstractEventLoop]) -> None:
        if loop and not loop.is_closed():
            self._loop = loop

    async def connect(
        self,
        websocket: WebSocket,
        user_id: str,
        role: str,
        email: str = "",
        hospital_id: Optional[str] = None,
    ) -> None:
        self.set_loop(asyncio.get_running_loop())
        await websocket.accept()
        client = ConnectedClient(
            websocket=websocket,
            user_id=str(user_id),
            role=(role or "").upper(),
            email=email or "",
            hospital_id=str(hospital_id) if hospital_id else None,
        )
        self._clients[websocket] = client
        self._by_user.setdefault(client.user_id, set()).add(websocket)
        self._by_role.setdefault(client.role, set()).add(websocket)

        await self._send_safe(
            websocket,
            {
                "event": "connected",
                "data": {
                    "userId": client.user_id,
                    "role": client.role,
                    "serverTime": datetime.now(timezone.utc).isoformat(),
                },
            },
        )

    def disconnect(self, websocket: WebSocket) -> None:
        client = self._clients.pop(websocket, None)
        if not client:
            return
        user_sockets = self._by_user.get(client.user_id)
        if user_sockets:
            user_sockets.discard(websocket)
            if not user_sockets:
                self._by_user.pop(client.user_id, None)
        role_sockets = self._by_role.get(client.role)
        if role_sockets:
            role_sockets.discard(websocket)
            if not role_sockets:
                self._by_role.pop(client.role, None)

    async def _send_safe(self, websocket: WebSocket, payload: Dict[str, Any]) -> bool:
        try:
            await websocket.send_json(payload)
            return True
        except Exception:
            self.disconnect(websocket)
            return False

    async def broadcast_event(
        self,
        event: str,
        data: Dict[str, Any],
        target_users: Optional[Iterable[str]] = None,
        target_roles: Optional[Iterable[str]] = None,
    ) -> int:
        envelope = {
            "event": event,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        recipients: Set[WebSocket] = set()

        if target_users is not None:
            for uid in target_users:
                if uid:
                    recipients.update(self._by_user.get(str(uid), set()))

        if target_roles is not None:
            for r in target_roles:
                if r:
                    recipients.update(self._by_role.get(str(r).upper(), set()))

        if target_users is None and target_roles is None:
            recipients.update(self._clients.keys())

        sent_count = 0
        for ws in list(recipients):
            if await self._send_safe(ws, envelope):
                sent_count += 1
        return sent_count

    def emit_sync(
        self,
        event: str,
        data: Dict[str, Any],
        target_users: Optional[Iterable[str]] = None,
        target_roles: Optional[Iterable[str]] = None,
    ) -> None:
        """Schedules broadcast from synchronous service/route code onto the ASGI loop."""
        loop = self._loop
        if not loop or loop.is_closed():
            return
        coro = self.broadcast_event(
            event=event,
            data=data,
            target_users=list(target_users) if target_users is not None else None,
            target_roles=list(target_roles) if target_roles is not None else None,
        )
        try:
            running = None
            try:
                running = asyncio.get_running_loop()
            except RuntimeError:
                running = None
            if running is loop:
                asyncio.create_task(coro)
            else:
                asyncio.run_coroutine_threadsafe(coro, loop)
        except Exception:
            try:
                coro.close()
            except Exception:
                pass

    def get_active_stats(self) -> Dict[str, Any]:
        return {
            "totalConnections": len(self._clients),
            "byRole": {role: len(sockets) for role, sockets in self._by_role.items()},
        }


manager = ConnectionManager()


def emit_realtime_event(
    event: str,
    data: Dict[str, Any],
    target_users: Optional[Iterable[str]] = None,
    target_roles: Optional[Iterable[str]] = None,
) -> None:
    """Convenience helper to dispatch real-time events safely from any sync handler."""
    manager.emit_sync(event=event, data=data, target_users=target_users, target_roles=target_roles)

