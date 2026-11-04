export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const URGENCIES = [
  { value: 'LOW', label: 'Low', badgeClass: 'bg-secondary text-white' },
  { value: 'NORMAL', label: 'Normal', badgeClass: 'bg-info text-dark' },
  { value: 'HIGH', label: 'High', badgeClass: 'bg-warning text-dark' },
  { value: 'EMERGENCY', label: 'EMERGENCY', badgeClass: 'bg-danger text-white' }
];

export const REQUEST_STATUSES = [
  { key: 'PENDING', label: 'Pending', step: 1 },
  { key: 'APPROVED', label: 'Approved', step: 2 },
  { key: 'MATCHED', label: 'Donors Matched', step: 3 },
  { key: 'DONOR_CONTACTED', label: 'Donor Contacted', step: 4 },
  { key: 'ACCEPTED', label: 'Donor Accepted', step: 5 },
  { key: 'SCREENING_SUBMITTED', label: 'Screening Submitted – Awaiting Review', step: 6 },
  { key: 'SCHEDULED', label: 'Medically Approved & Scheduled', step: 7 },
  { key: 'FULFILLED', label: 'Fulfilled', step: 8 },
  { key: 'DONATION_COMPLETED', label: 'Donation Completed', step: 9 },
  { key: 'REJECTED', label: 'Rejected', step: 0 },
  { key: 'CLOSED', label: 'Request Closed', step: 10 },
  { key: 'CANCELLED', label: 'Cancelled', step: 0 }
];

export const BLOOD_COMPATIBILITY_INFO = {
  'O-': {
    canDonateTo: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    canReceiveFrom: ['O-'],
    type: 'Universal Red Cell Donor',
    description: 'Vital in acute trauma centers when patient blood type is unknown before surgery.'
  },
  'O+': {
    canDonateTo: ['O+', 'A+', 'B+', 'AB+'],
    canReceiveFrom: ['O+', 'O-'],
    type: 'Most Common Blood Type',
    description: 'Frequently requested for routine surgeries, trauma, and cancer treatments.'
  },
  'A-': {
    canDonateTo: ['A-', 'A+', 'AB-', 'AB+'],
    canReceiveFrom: ['A-', 'O-'],
    type: 'Specialized Donor',
    description: 'Crucial for A- and AB- patients undergoing surgical interventions.'
  },
  'A+': {
    canDonateTo: ['A+', 'AB+'],
    canReceiveFrom: ['A+', 'A-', 'O+', 'O-'],
    type: 'High Demand',
    description: 'One of the most widespread blood types in hospital blood bank reserves.'
  },
  'B-': {
    canDonateTo: ['B-', 'B+', 'AB-', 'AB+'],
    canReceiveFrom: ['B-', 'O-'],
    type: 'Rare Donor Type',
    description: 'Needed for pediatric and adult B- recipients with limited compatible sources.'
  },
  'B+': {
    canDonateTo: ['B+', 'AB+'],
    canReceiveFrom: ['B+', 'B-', 'O+', 'O-'],
    type: 'Critical Need',
    description: 'Widely used in medical blood therapies and surgical emergency reserves.'
  },
  'AB-': {
    canDonateTo: ['AB-', 'AB+'],
    canReceiveFrom: ['AB-', 'A-', 'B-', 'O-'],
    type: 'Rarest Blood Group',
    description: 'Special plasma and platelet utility across intensive care departments.'
  },
  'AB+': {
    canDonateTo: ['AB+'],
    canReceiveFrom: ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
    type: 'Universal Red Cell Recipient',
    description: 'Can receive red cells from all eight standard blood types safely.'
  }
};

export const INDIAN_STATES_AND_CITIES = {
  'Andaman and Nicobar Islands': ['Port Blair'],
  'Andhra Pradesh': [
    'Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool',
    'Tirupati', 'Kakinada', 'Rajahmundry', 'Kadapa', 'Anantapur',
    'Eluru', 'Vizianagaram', 'Ongole', 'Nandyal', 'Machilipatnam'
  ],
  'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Pasighat', 'Tawang', 'Ziro'],
  'Assam': [
    'Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon',
    'Tinsukia', 'Tezpur', 'Bongaigaon', 'Karimganj', 'Sivasagar'
  ],
  'Bihar': [
    'Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia',
    'Darbhanga', 'Bihar Sharif', 'Arrah', 'Begusarai', 'Katihar', 'Munger'
  ],
  'Chandigarh': ['Chandigarh'],
  'Chhattisgarh': [
    'Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Rajnandgaon',
    'Durg', 'Jagdalpur', 'Ambikapur', 'Raigarh'
  ],
  'Dadra and Nagar Haveli and Daman and Diu': ['Daman', 'Diu', 'Silvassa'],
  'Delhi': [
    'New Delhi', 'North Delhi', 'South Delhi', 'East Delhi',
    'West Delhi', 'Central Delhi', 'Dwarka', 'Rohini', 'Connaught Place'
  ],
  'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda'],
  'Gujarat': [
    'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar',
    'Jamnagar', 'Gandhinagar', 'Junagadh', 'Anand', 'Navsari', 'Morbi', 'Mehsana'
  ],
  'Haryana': [
    'Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Yamunanagar',
    'Rohtak', 'Hisar', 'Karnal', 'Sonipat', 'Panchkula', 'Sirsa'
  ],
  'Himachal Pradesh': ['Shimla', 'Dharamshala', 'Mandi', 'Solan', 'Kullu', 'Hamirpur', 'Bilaspur'],
  'Jammu and Kashmir': ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Udhampur', 'Kathua', 'Sopore'],
  'Jharkhand': [
    'Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro Steel City',
    'Deoghar', 'Hazaribagh', 'Giridih', 'Ramgarh'
  ],
  'Karnataka': [
    'Bengaluru', 'Mysuru', 'Hubballi-Dharwad', 'Mangaluru', 'Belagavi',
    'Davangere', 'Ballari', 'Kalaburagi', 'Shivamogga', 'Tumakuru', 'Udupi', 'Bidar'
  ],
  'Kerala': [
    'Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Kollam', 'Thrissur',
    'Kannur', 'Alappuzha', 'Kottayam', 'Palakkad', 'Malappuram', 'Kasaragod'
  ],
  'Ladakh': ['Leh', 'Kargil'],
  'Lakshadweep': ['Kavaratti', 'Agatti'],
  'Madhya Pradesh': [
    'Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain',
    'Sagar', 'Dewas', 'Satna', 'Ratlam', 'Rewa', 'Singrauli'
  ],
  'Maharashtra': [
    'Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik',
    'Chhatrapati Sambhajinagar', 'Solapur', 'Kolhapur', 'Navi Mumbai',
    'Amravati', 'Nanded', 'Sangli', 'Jalgaon', 'Akola', 'Latur'
  ],
  'Manipur': ['Imphal', 'Churachandpur', 'Thoubal', 'Kakching'],
  'Meghalaya': ['Shillong', 'Tura', 'Jowai'],
  'Mizoram': ['Aizawl', 'Lunglei', 'Champhai'],
  'Nagaland': ['Kohima', 'Dimapur', 'Mokokchung'],
  'Odisha': [
    'Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur',
    'Puri', 'Balasore', 'Bhadrak', 'Baripada'
  ],
  'Puducherry': ['Puducherry', 'Karaikal', 'Ozhukarai'],
  'Punjab': [
    'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda',
    'Mohali', 'Hoshiarpur', 'Pathankot', 'Moga'
  ],
  'Rajasthan': [
    'Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer',
    'Udaipur', 'Bhilwara', 'Alwar', 'Sikar', 'Sri Ganganagar', 'Bharatpur'
  ],
  'Sikkim': ['Gangtok', 'Namchi', 'Gyalshing'],
  'Tamil Nadu': [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem',
    'Tirunelveli', 'Tiruppur', 'Erode', 'Vellore', 'Thoothukudi',
    'Dindigul', 'Thanjavur', 'Ranipet', 'Sivakasi', 'Karur',
    'Hosur', 'Nagercoil', 'Kanchipuram', 'Cuddalore', 'Kumbakonam'
  ],
  'Telangana': [
    'Hyderabad', 'Warangal', 'Nizamabad', 'Khammam', 'Karimnagar',
    'Ramagundam', 'Secunderabad', 'Mahbubnagar', 'Nalgonda', 'Adilabad'
  ],
  'Tripura': ['Agartala', 'Udaipur', 'Dharmanagar'],
  'Uttar Pradesh': [
    'Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Noida',
    'Greater Noida', 'Prayagraj', 'Ghaziabad', 'Meerut', 'Bareilly',
    'Aligarh', 'Moradabad', 'Gorakhpur', 'Mathura', 'Ayodhya', 'Jhansi'
  ],
  'Uttarakhand': ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rishikesh', 'Nainital'],
  'West Bengal': [
    'Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri',
    'Bardhaman', 'Malda', 'Kharagpur', 'Haldia', 'Darjeeling'
  ]
};

export const INDIAN_STATES = Object.keys(INDIAN_STATES_AND_CITIES).sort();

export const DEFAULT_STATE = 'Tamil Nadu';
export const DEFAULT_CITY = 'Chennai';

export const getCitiesByState = (stateName) => {
  if (!stateName || !INDIAN_STATES_AND_CITIES[stateName]) {
    return INDIAN_STATES_AND_CITIES[DEFAULT_STATE] || [];
  }
  return INDIAN_STATES_AND_CITIES[stateName];
};

export const getStateForCity = (cityName) => {
  if (!cityName) return DEFAULT_STATE;
  for (const [state, cities] of Object.entries(INDIAN_STATES_AND_CITIES)) {
    if (cities.some(c => c.toLowerCase() === cityName.toLowerCase())) {
      return state;
    }
  }
  return DEFAULT_STATE;
};

// Flattened list of all cities across all Indian states and UTs
export const CITIES = Array.from(
  new Set(Object.values(INDIAN_STATES_AND_CITIES).flat())
).sort();

export const MEDICAL_DISCLAIMER = 
  "DISCLAIMER: Lifeline donor matching algorithms are designed solely as a software decision aid. " +
  "They do not replace medical crossmatching, antibody screening, or physician clinical oversight. " +
  "All transfusion protocols and compatibility verifications must be confirmed by certified hospital blood banks.";
