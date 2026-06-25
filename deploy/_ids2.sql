select id, "userType", coalesce("teamName","companyName","fullName",'') as name, email, "createdAt" from public.users order by "createdAt";
