import { House, Car, Trees, Zap, Sparkles, GraduationCap, HeartPulse, Laptop, HardHat, SprayCan, PawPrint, PartyPopper } from 'lucide-react';

// The single list of service categories used by Browse, Search, listings and admin.
export const CATEGORIES = [
  { key: 'home', label: 'Home services', subs: ['Plumbing', 'Aircon Service', 'Electrical', 'Painting', 'Carpentry', 'Waterproofing', 'Door & Window Repair', 'Gas & LPG', 'Deep Cleaning', 'Pest Control'] },
  { key: 'auto', label: 'Automotive', subs: ['General Auto Repair', 'Car Aircon', 'Tires & Wheels', 'PMS / Oil Change', 'Battery', 'Car Wash & Detailing', 'Car Locksmith', 'Towing', 'Window Tint'] },
  { key: 'garden', label: 'Garden & lawn', subs: ['Lawn Mowing', 'Tree Trimming', 'Landscaping', 'Pest Control', 'Irrigation', 'Garden Design'] },
  { key: 'elec', label: 'Electrical', subs: ['Wiring & Rewiring', 'Solar Installation', 'Lighting', 'CCTV Installation', 'Network / Internet Setup', 'Generator Service'] },
  { key: 'beauty', label: 'Beauty & wellness', subs: ['Haircut & Styling', 'Nails', 'Facial & Skincare', 'Massage', 'Personal Training', 'Makeup Artist'] },
  { key: 'edu', label: 'Education & tutoring', subs: ['Academic Tutoring', 'Language Lessons', 'Music Lessons', 'Dance Lessons', 'Online Tutoring', 'Exam Review', 'Computer Lessons', 'Arts & Crafts', 'Homework Assistance', 'Special Education Support'] },
  { key: 'health', label: 'Health & care', subs: ['Home Nursing', 'Home Laboratory', 'Elder Care', 'Baby Care', 'Medicine Delivery', 'Dental (Home Visit)'] },
  { key: 'tech', label: 'Tech & IT', subs: ['Laptop Repair', 'Desktop Repair', 'Network Setup', 'Printer Repair', 'Phone Repair', 'Data Recovery'] },
  { key: 'build', label: 'Construction', subs: ['Renovation', 'Civil / Structural Engineering', 'Architecture', 'Masonry', 'Drainage Works', 'Driveway & Flooring'] },
  { key: 'clean', label: 'Cleaning', subs: ['House Cleaning', 'Office Cleaning', 'Upholstery Cleaning', 'Carpet Cleaning', 'Laundry', 'Junk Removal'] },
  { key: 'pet', label: 'Pet services', subs: ['Pet Grooming', 'Pet Sitting', 'Veterinary (Home Visit)', 'Dog Walking', 'Pet Hotel', 'Vaccination'] },
  { key: 'event', label: 'Events', subs: ['Photography', 'DJ / Live Band', 'Catering', 'Event Host / MC', 'Tent & Tables Rental', 'Decorations'] },
];
export const catLabel = (key) => CATEGORIES.find((c) => c.key === key)?.label || key;
export const CAT_ICONS = { home: House, auto: Car, garden: Trees, elec: Zap, beauty: Sparkles, edu: GraduationCap, health: HeartPulse, tech: Laptop, build: HardHat, clean: SprayCan, pet: PawPrint, event: PartyPopper };
