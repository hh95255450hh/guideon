select id, "userType", coalesce("teamName", "companyName", "fullName") as name, email from public.users order by id;
