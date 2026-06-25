select 'packages' t, count(*) from public.tour_packages where "providerId"='team-6ed5166d'
union all select 'bookings_as_guide', count(*) from public.bookings where "guideId"='team-6ed5166d'
union all select 'reviews', count(*) from public.reviews where "guideId"='team-6ed5166d'
union all select 'notifications', count(*) from public.notifications where "userId"='team-6ed5166d'
union all select 'messages', count(*) from public.messages where "fromId"='team-6ed5166d' or "toId"='team-6ed5166d';
