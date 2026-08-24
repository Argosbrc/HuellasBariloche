import {
  Award,
  Binoculars,
  CircleUserRound,
  HeartHandshake,
  House,
  MessageCircleHeart,
  PawPrint,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";

const icons = {
  "paw-print": PawPrint,
  binoculars: Binoculars,
  "shield-heart": ShieldCheck,
  "house-heart": House,
  trophy: Trophy,
  "message-heart": MessageCircleHeart,
  sparkles: Sparkles,
  "circle-user-round": CircleUserRound,
  "heart-handshake": HeartHandshake,
} as const;

export function BadgeIcon({ name, size = 24 }: { name: string; size?: number }) {
  const Icon = icons[name as keyof typeof icons] || Award;
  return <Icon size={size} />;
}
