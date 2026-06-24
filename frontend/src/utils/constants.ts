import { Car, Bike, Truck } from 'lucide-react';

export const LOT_LABELS: Record<string, string> = { C: 'Car', Y: 'Motorcycle', H: 'Heavy Vehicle', S: 'Season' };
export const LOT_ICONS: Record<string, typeof Car> = { C: Car, Y: Bike };
export const DAY_LABELS: Record<string, string> = { weekday: 'Weekday', weekday_eve: 'Weekday Eve', saturday: 'Saturday', sunday: 'Sun / PH', all: 'All Days' };
export const VEHICLE_OPTIONS = [['C', Car, 'Car'], ['Y', Bike, 'Motorcycle'], ['H', Truck, 'Heavy']] as const;
export const BUDGET_OPTIONS = [null, 3, 5, 10, 20] as const;
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/\\`~]).{8,}$/;
export const PASSWORD_ERROR = 'Password needs 8+ characters with uppercase, lowercase, number, and special character.';
