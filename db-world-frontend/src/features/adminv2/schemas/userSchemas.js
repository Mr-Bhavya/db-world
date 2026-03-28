import { z } from 'zod';

export const createUserSchema = z.object({
  firstName: z.string().min(2, 'Min 2 chars').max(20, 'Max 20 chars'),
  lastName:  z.string().min(1, 'Min 1 char').max(20, 'Max 20 chars'),
  dob:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: yyyy-MM-dd').optional().or(z.literal('')),
  gender:    z.string().min(1, 'Required'),
  mobileNo:  z.coerce.number()
               .min(999999999, 'Must be at least 9 digits')
               .max(9999999999, 'Must be at most 10 digits'),
  email:     z.string().email('Invalid email'),
  password:  z.string().min(6, 'Min 6 chars').max(100, 'Max 100 chars'),
  roleId:    z.coerce.number().optional(),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(2).max(20),
  lastName:  z.string().min(1).max(20),
  dob:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  gender:    z.string().min(1),
  mobileNo:  z.coerce.number().min(999999999).max(9999999999),
  password:  z.string().min(6).max(100),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword:     z.string().min(6, 'Min 6 chars').max(100),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
