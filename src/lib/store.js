import { supabase, isSupabaseConfigured } from './supabase';

const empty = {
  donations: [],
  requests: [],
  assignments: [],
  notifications: [],
  volunteers: [],
  users: []
};

let cache = structuredClone(empty);
const listeners = new Set();
let channel;

const title = value => ({
  available: 'Available',
  reserved: 'Reserved',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  completed: 'Delivered',
  cancelled: 'Cancelled',
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  assigned: 'Assigned',
  delivered: 'Delivered'
})[value] || value;

const key = value => ({
  Available: 'available',
  Reserved: 'reserved',
  'Picked up': 'picked_up',
  'In transit': 'in_transit',
  Delivered: 'delivered',
  Completed: 'completed',
  Cancelled: 'cancelled',
  Pending: 'pending',
  Accepted: 'accepted',
  Rejected: 'rejected',
  Assigned: 'assigned'
})[value] || String(value || '').toLowerCase().replaceAll(' ', '_');

function emit() {
  listeners.forEach(listener => listener(cache));
}

function profileMap(rows) {
  return Object.fromEntries((rows || []).map(profile => [profile.id, profile]));
}

function readableError(error, fallback) {
  if (!error) return fallback;
  if (error.code === '42501') {
    return 'Supabase denied this action (RLS permission). Check the policies on profiles and pickup_assignments.';
  }
  return error.message || error.details || fallback;
}

export function getData() {
  return cache;
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(cache);
  loadData().catch(error => console.error('FoodBridge data load failed:', error));

  if (isSupabaseConfigured && !channel) {
    channel = supabase
      .channel('foodbridge-live')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        loadData().catch(error => console.error('FoodBridge realtime refresh failed:', error));
      })
      .subscribe();
  }

  return () => listeners.delete(listener);
}

export async function loadData() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;

  if (!user) {
    cache = structuredClone(empty);
    emit();
    return cache;
  }

  const [profilesRes, donationsRes, requestsRes, assignmentsRes, notificationsRes] = await Promise.all([
    supabase.from('profiles').select('id,full_name,role,organisation,is_verified'),
    supabase.from('donations').select('*').order('created_at', { ascending: false }),
    supabase.from('donation_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('pickup_assignments').select('*').order('created_at', { ascending: false }),
    supabase.from('notifications').select('*').order('created_at', { ascending: false })
  ]);

  for (const result of [profilesRes, donationsRes, requestsRes, assignmentsRes, notificationsRes]) {
    if (result.error) throw new Error(readableError(result.error, 'Could not load FoodBridge data.'));
  }

  const profiles = profilesRes.data || [];
  const profileById = profileMap(profiles);
  const donationRows = donationsRes.data || [];

  cache = {
    users: profiles,
    volunteers: profiles.filter(profile => profile.role === 'volunteer'),

    donations: donationRows.map(donation => ({
      id: donation.id,
      donor: profileById[donation.donor_id]?.organisation || profileById[donation.donor_id]?.full_name || 'Food donor',
      donorEmail: donation.donor_id,
      donorId: donation.donor_id,
      food: donation.food_name,
      category: donation.category,
      quantity: donation.quantity,
      servings: donation.servings,
      description: donation.description,
      address: donation.pickup_address,
      lat: donation.latitude,
      lng: donation.longitude,
      availableUntil: donation.available_until ? new Date(donation.available_until).toLocaleString() : '',
      expiry: donation.expiry_date || '',
      image: donation.image_url,
      status: title(donation.status),
      createdAt: new Date(donation.created_at).getTime()
    })),

    requests: (requestsRes.data || []).map(request => {
      const donation = donationRows.find(row => row.id === request.donation_id);
      return {
        id: request.id,
        donationId: request.donation_id,
        ngo: profileById[request.ngo_id]?.organisation || profileById[request.ngo_id]?.full_name || 'NGO',
        ngoEmail: request.ngo_id,
        ngoId: request.ngo_id,
        donorEmail: donation?.donor_id || '',
        message: request.message,
        status: title(request.status),
        createdAt: new Date(request.created_at).getTime()
      };
    }),

    assignments: (assignmentsRes.data || []).map(assignment => ({
      id: assignment.id,
      requestId: assignment.request_id,
      donationId: assignment.donation_id,
      volunteer: profileById[assignment.volunteer_id]?.full_name || 'Volunteer',
      volunteerEmail: assignment.volunteer_id,
      volunteerId: assignment.volunteer_id,
      ngo: profileById[assignment.ngo_id]?.organisation || profileById[assignment.ngo_id]?.full_name || 'NGO',
      ngoEmail: assignment.ngo_id,
      donor: profileById[assignment.donor_id]?.organisation || profileById[assignment.donor_id]?.full_name || 'Donor',
      address: donationRows.find(row => row.id === assignment.donation_id)?.pickup_address || '',
      status: title(assignment.status),
      lat: assignment.current_latitude,
      lng: assignment.current_longitude,
      createdAt: new Date(assignment.created_at).getTime()
    })),

    notifications: (notificationsRes.data || []).map(notification => ({
      ...notification,
      email: notification.user_id,
      read: Boolean(notification.read_at),
      createdAt: new Date(notification.created_at).getTime()
    }))
  };

  emit();
  return cache;
}

export async function addDonation(donation) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Please sign in again.');

  const asDate = value => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  };

  const asDay = value => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  };

  const payload = {
    donor_id: user.id,
    food_name: donation.food,
    category: donation.category,
    quantity: donation.quantity,
    servings: Number(donation.servings) || 0,
    description: donation.description || null,
    pickup_address: donation.address,
    latitude: donation.lat ?? null,
    longitude: donation.lng ?? null,
    available_until: asDate(donation.availableUntil),
    expiry_date: asDay(donation.expiry),
    image_url: donation.image || null
  };

  const { data, error } = await supabase.from('donations').insert(payload).select().single();
  if (error) throw new Error(readableError(error, 'Could not publish donation.'));

  await loadData();
  return data;
}

export async function createRequest(donation, _profile, message) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Please sign in again.');

  const { data, error } = await supabase
    .from('donation_requests')
    .insert({
      donation_id: donation.id,
      ngo_id: user.id,
      message: message || null
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Your organisation has already requested this donation.');
    }
    throw new Error(readableError(error, 'Could not send the food request.'));
  }

  await loadData();
  return data;
}

export async function updateRequest(id, status) {
  const nextStatus = key(status);
  const request = cache.requests.find(item => item.id === id);

  const { error } = await supabase
    .from('donation_requests')
    .update({ status: nextStatus })
    .eq('id', id);

  if (error) throw new Error(readableError(error, 'Could not update the request.'));

  if (nextStatus === 'accepted' && request?.donationId) {
    const { error: donationError } = await supabase
      .from('donations')
      .update({ status: 'reserved' })
      .eq('id', request.donationId);

    if (donationError) {
      throw new Error(`The request was accepted, but the donation status could not be updated: ${readableError(donationError, 'Database error')}`);
    }
  }

  await loadData();
}

export async function assignVolunteer(request, donation, volunteer) {
  if (!request?.id) throw new Error('The accepted request ID is missing.');
  if (!donation?.id) throw new Error('The donation ID is missing.');
  if (!volunteer?.id) throw new Error('The volunteer profile ID is missing.');

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Your NGO session has expired. Please sign in again.');

  if (request.ngoEmail && request.ngoEmail !== user.id) {
    throw new Error('You can only assign volunteers to requests belonging to your NGO account.');
  }

  const payload = {
    request_id: request.id,
    donation_id: donation.id,
    ngo_id: user.id,
    donor_id: donation.donorId,
    volunteer_id: volunteer.id,
    status: 'assigned'
  };

  // Do not chain select() here: an INSERT can succeed even when the role lacks
  // permission to read the inserted row. The following loadData refreshes the UI.
  const { error } = await supabase.from('pickup_assignments').insert(payload);
  if (error) {
    if (error.code === '23505') {
      throw new Error('A volunteer has already been assigned to this request. Refresh the NGO dashboard.');
    }
    throw new Error(readableError(error, 'Supabase could not create the pickup assignment.'));
  }

  try {
    await loadData();
  } catch (refreshError) {
    console.error('Assignment was created, but the dashboard refresh failed:', refreshError);
  }
}

export async function updateAssignment(id, status, location) {
  const values = { status: key(status) };

  if (location) {
    values.current_latitude = location.lat;
    values.current_longitude = location.lng;
    values.location_updated_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('pickup_assignments')
    .update(values)
    .eq('id', id);

  if (error) throw new Error(readableError(error, 'Could not update the pickup assignment.'));
  await loadData();
}

export async function getCurrentPosition() {
  if (!navigator.geolocation) throw new Error('Geolocation is not supported.');

  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
    position => resolve({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy
    }),
    error => reject(new Error(error.message)),
    { enableHighAccuracy: true, timeout: 12000 }
  ));
}

export const demoUsers = [];

export function resetDemo() {
  return loadData();
}

export async function refreshData() {
  return loadData();
}