# Simple barber login (Admin / Admin12345)

## What changes for Hammam
- The barber page login shows two fields only: **اسم المستخدم** and **كلمة المرور**.
- Typing `Admin` and `Admin12345` opens the dashboard right away. No email and no confirmation link.
- The "create account" option goes away, so nobody else can sign up as the barber.
- Sign-in is remembered on the phone, so Hammam doesn't need to type it every time.

## Checking that the barber dashboard works
After the change, test the whole flow:
1. Log in with Admin / Admin12345 and check the dashboard opens.
2. As a customer, book a slot on the main page and check it appears for the barber with the alert sound.
3. Add a walk-in and check it lands on the nearest free time.
4. Mark a booking as "تم" and cancel another, and check both update.
5. Check the wrong password shows a clear error message.
6. Log out, then confirm customers can't see or change bookings without logging in.

## Technical details
- Sign-in turns the username into a fixed internal email (`admin` -> `admin@hm-salon.local`). It's normalized to lowercase, so "Admin" and "admin" both work.
- Create (or reset) the auth user with that email and password `Admin12345`, already confirmed, using a one-time admin-privileged operation. Then make sure that user has a row in `user_roles` with role `admin`.
- Remove admin from any other existing accounts, so only this one account controls the dashboard.
- Update `handle_new_user` so it no longer gives admin to a new signup automatically. Admin is granted only to the fixed account.
- Change `Login` in `src/routes/barber.tsx`: use a username field, remove the sign-up mode, and keep the `has_role` check before showing the dashboard.
- Note: with a fixed account, password reset by email won't work. To change the password later, Hammam can just ask.
