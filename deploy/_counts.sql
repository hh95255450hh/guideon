select 'users' t, count(*) from public.users
union all select 'tour_packages', count(*) from public.tour_packages
union all select 'bookings', count(*) from public.bookings
union all select 'messages', count(*) from public.messages
union all select 'reviews', count(*) from public.reviews
union all select 'notifications', count(*) from public.notifications
order by 1;
