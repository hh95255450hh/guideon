select id, "userType", "fullName", email, "isVerified", "isSuspended"
from public.users
where email='alshukili2012@gmail.com' or "fullName" like '%الصمود%';
