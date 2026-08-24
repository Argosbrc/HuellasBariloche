export type HomeSummary = {
  city_id: string;
  city_slug: string;
  city_name: string;
  lost_cases: number;
  found_cases: number;
  available_adoptions: number;
  verified_rescuers: number;
  active_campaigns: number;
  community_posts: number;
  published_services: number;
};

export type CommunityBadge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  points_required: number;
  rule_key: string | null;
  threshold: number | null;
  sort_order: number;
};

export type CommunityRankingEntry = {
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
  points: number;
  badge_count: number;
};

export type CommunityRecentAward = {
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
  badge_id: string;
  badge_name: string;
  badge_icon: string;
  awarded_at: string;
};

export type CommunityMedalBoard = {
  badges: CommunityBadge[];
  ranking: CommunityRankingEntry[];
  recent_awards: CommunityRecentAward[];
  my_profile_id: string | null;
  my_badge_ids: string[];
};

export type PublicCommunityProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  role: "member" | "rescuer" | "admin" | string;
  points: number;
  created_at: string;
  badge_count: number;
  badges: Array<CommunityBadge & { awarded_at: string }>;
  confirmed_sightings: number;
  reunions_helped: number;
};

export type PublicReunion = {
  id: string;
  name: string | null;
  species: string;
  breed: string | null;
  zone_name: string | null;
  photo_url: string | null;
  family_name: string;
  reunited_at: string;
  contributor_count: number;
};

export type NearbyLostCase = {
  id: string;
  name: string | null;
  zone_name: string | null;
  photo_url: string | null;
  distance_m: number;
  created_at: string;
};

export type NearbyAlertPreferences = {
  enabled: boolean;
  radius_km: 3 | 5;
  has_location: boolean;
  nearby_cases: NearbyLostCase[];
};

export type PublicPetCase = {
  id: string;
  owner_id: string;
  owner_display_name: string | null;
  rescuer_name: string | null;
  city_name: string;
  post_type: "lost" | "found" | "adoption" | string;
  post_state: string;
  name: string | null;
  species: string | null;
  breed: string | null;
  sex: string | null;
  age_label: string | null;
  size_label: string | null;
  colors: string[] | null;
  distinctive_features: string | null;
  description: string | null;
  photo_paths: string[];
  cover_image_path: string | null;
  image_count: number;
  zone_name: string | null;
  public_latitude: number | null;
  public_longitude: number | null;
  event_at: string | null;
  created_at: string;
  sighting_count: number;
};

export type PublicAdoption = PublicPetCase & {
  vaccinated: boolean | null;
  dewormed: boolean | null;
  neutered: boolean | null;
  good_with_children: boolean | null;
  good_with_dogs: boolean | null;
  good_with_cats: boolean | null;
  home_requirements: string | null;
};

export type PublicPetCaseContact = {
  pet_post_id: string;
  publisher_name: string;
  whatsapp: string;
};

export type AdoptionApplicationReceived = {
  id: string;
  pet_post_id: string;
  pet_name: string | null;
  cover_image_url: string | null;
  full_name: string;
  home_address: string;
  phone: string;
  locality: string;
  secure_home: "yes" | "no" | "apartment_safe_balcony";
  financial_capacity: "yes" | "no" | "with_effort";
  neuter_commitment: "agreed" | "cannot_guarantee";
  follow_up_commitment: "agreed" | "prefer_not";
  status: "pending" | "accepted" | "rejected" | string;
  created_at: string;
};

export type AdoptionApplicationSent = {
  id: string;
  pet_post_id: string;
  pet_name: string | null;
  cover_image_url: string | null;
  rescuer_name: string;
  status: "pending" | "accepted" | "rejected" | string;
  created_at: string;
};

export type AdoptionDashboard = {
  received: AdoptionApplicationReceived[];
  sent: AdoptionApplicationSent[];
};

export type PetSightingAlert = {
  id: string;
  pet_post_id: string;
  pet_name: string | null;
  cover_image_url: string | null;
  alert_kind: "sighting" | "sheltered" | string;
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  message: string;
  contact_phone: string | null;
  contact_social: string | null;
  reporter_name: string | null;
  status: "new" | "contacted" | "resolved" | "dismissed" | string;
  created_at: string;
};

export type PetPostStateHistory = {
  from_state: string | null;
  to_state: string;
  reason: string | null;
  created_at: string;
};

export type EditablePetPost = {
  id: string;
  post_type: "lost" | "found" | "adoption" | string;
  post_state: string;
  name: string | null;
  species: string;
  breed: string | null;
  sex: string | null;
  age_label: string | null;
  size_label: string | null;
  colors: string[];
  distinctive_features: string | null;
  description: string;
  health_status: string | null;
  adoption_requirements: string | null;
  photo_paths: string[];
  zone_name: string | null;
  public_latitude: number | null;
  public_longitude: number | null;
  exact_latitude: number | null;
  exact_longitude: number | null;
  address_notes: string | null;
  show_whatsapp: boolean;
  event_at: string | null;
  created_at: string;
  updated_at: string;
  history: PetPostStateHistory[];
};

export type CommunityPost = {
  id: string;
  author_id: string;
  author_display_name: string;
  author_avatar_url: string | null;
  post_type: string;
  body: string;
  place_name: string | null;
  event_at: string | null;
  created_at: string;
  cover_image_path: string | null;
  media: Array<{
    id: string;
    storage_path: string;
    mime_type: string;
    width: number;
    height: number;
    position: number;
    alt_text: string;
  }>;
  comments_count: number;
  likes_count: number;
  shares_count: number;
  liked_by_me: boolean;
  resolved_at: string | null;
  expires_at: string | null;
};

export type CommunityComment = {
  id: string;
  post_id: string;
  author_id: string;
  author_display_name: string;
  author_avatar_url: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

export type MyCommunityPost = {
  id: string;
  post_type: string;
  body: string;
  place_name: string | null;
  event_at: string | null;
  created_at: string;
  updated_at: string;
  moderation_status: string;
  resolved_at: string | null;
  expires_at: string | null;
  is_expired: boolean;
  cover_image_path: string | null;
  comments_count: number;
  likes_count: number;
};

export type ConversationInboxItem = {
  id: string;
  pet_post_id: string;
  pet_name: string | null;
  pet_state: string;
  pet_photo_url: string | null;
  other_user_id: string;
  other_display_name: string;
  other_avatar_url: string | null;
  last_message_at: string | null;
  last_message: string | null;
  last_sender_id: string | null;
  unread_count: number;
  blocked_by_me: boolean;
  blocked_me: boolean;
};

export type ConversationMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  mine: boolean;
};

export type ConversationDetail = {
  id: string;
  pet_post_id: string;
  pet_name: string | null;
  pet_state: string;
  pet_photo_url: string | null;
  other_user_id: string;
  other_display_name: string;
  other_avatar_url: string | null;
  blocked_by_me: boolean;
  blocked_me: boolean;
  messages: ConversationMessage[];
};

export type PublicCampaign = {
  id: string;
  rescuer_name: string;
  title: string;
  description: string;
  zone_name: string | null;
  cover_image_path: string | null;
  item_count: number;
  completed_item_count: number;
  ends_at: string | null;
};

export type PublicService = {
  id: string;
  city_name: string;
  category_slug: string;
  category_name: string;
  slug: string;
  name: string;
  summary: string;
  description: string | null;
  address: string | null;
  neighborhood: string | null;
  phone: string | null;
  whatsapp: string | null;
  emergency_phone: string | null;
  website: string | null;
  instagram: string | null;
  opening_hours: unknown;
  is_emergency: boolean;
  is_24_hours: boolean;
  rating_average: number;
  rating_count: number;
  cover_image_path: string | null;
  home_visit: boolean;
  has_on_call: boolean;
  specializations: string[];
  product_types: string[];
  delivery_available: boolean;
  payment_methods: string[];
  facebook: string | null;
  tiktok: string | null;
  useful_notes: string | null;
};

export type PublicRescuer = {
  id: string;
  organization_name: string;
  display_name: string;
  description: string | null;
  contact_area: string | null;
  city_name: string;
  social_url: string | null;
  avatar_url: string | null;
  donation_alias: string | null;
  donation_note: string | null;
  current_needs: string[];
  public_phone: string | null;
  public_email: string | null;
  instagram: string | null;
  facebook: string | null;
  website: string | null;
  adoption_count: number;
  created_at: string;
};

export type PublicTransitRequest = {
  id: string;
  pet_post_id: string;
  rescuer_profile_id: string;
  organization_name: string;
  rescuer_name: string;
  city_name: string;
  title: string;
  description: string;
  zone_name: string | null;
  requirements: string;
  pet_name: string | null;
  species: string;
  breed: string | null;
  sex: string | null;
  age_label: string | null;
  size_label: string | null;
  photo_paths: string[];
  cover_image_url: string | null;
  ends_at: string | null;
  created_at: string;
  pending_offer_count: number;
};

export type TransitOfferDashboard = {
  id: string;
  offerer_name: string;
  message: string | null;
  status: "pending" | "accepted" | "rejected" | string;
  home_zone: string | null;
  availability: string;
  has_dogs: boolean | null;
  has_cats: boolean | null;
  has_children: boolean | null;
  contact_whatsapp: string | null;
  created_at: string;
};

export type TransitRequestDashboard = {
  campaign_id: string;
  pet_post_id: string;
  title: string;
  status: "active" | "completed" | "closed" | string;
  pet_name: string | null;
  species: string;
  zone_name: string | null;
  cover_image_url: string | null;
  created_at: string;
  offers: TransitOfferDashboard[];
};

export type TransitOfferMade = {
  id: string;
  campaign_id: string;
  title: string;
  pet_name: string | null;
  organization_name: string;
  status: "pending" | "accepted" | "rejected" | string;
  created_at: string;
};

export type TransitDashboard = {
  requests: TransitRequestDashboard[];
  offers_made: TransitOfferMade[];
};

export type PublicDataResult<T> = {
  data: T;
  configured: boolean;
  error?: string;
};
