export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  COMPANY_ADMIN: 'company_admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
  CLIENT: 'client',
}

export const users = [
  {
    id: 'u-1',
    name: 'Jidnyasa Girase',
    email: 'jidnyasa.girase@technova.in',
    password: 'password123',
    role: ROLES.COMPANY_ADMIN,
    company: 'TechNova Solutions',
    avatar: null,
    designation: 'Founder & CEO',
    department: 'Leadership',
    phone: '+91 98765 43210',
  },
  {
    id: 'u-2',
    name: 'Jay Girase',
    email: 'jay.girase@technova.in',
    password: 'password123',
    role: ROLES.MANAGER,
    company: 'TechNova Solutions',
    avatar: null,
    designation: 'Project Manager',
    department: 'Delivery',
    phone: '+91 98220 11223',
  },
  {
    id: 'u-3',
    name: 'Rohit Girase',
    email: 'rohit.girase@technova.in',
    password: 'password123',
    role: ROLES.EMPLOYEE,
    company: 'TechNova Solutions',
    avatar: null,
    designation: 'Senior Frontend Developer',
    department: 'Engineering',
    phone: '+91 90210 55678',
  },
  {
    id: 'u-4',
    name: 'Sneha Joshi',
    email: 'sneha.joshi@technova.in',
    password: 'password123',
    role: ROLES.EMPLOYEE,
    company: 'TechNova Solutions',
    avatar: null,
    designation: 'UI/UX Designer',
    department: 'Design',
    phone: '+91 90210 99887',
  },
  {
    id: 'u-5',
    name: 'Aditi Rao',
    email: 'aditi@brightpixel.in',
    password: 'password123',
    role: ROLES.CLIENT,
    company: 'BrightPixel Labs',
    avatar: null,
    designation: 'Marketing Head',
    department: null,
    phone: '+91 91234 56780',
  },
]

export function findUserByEmail(email) {
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase())
}
