#!/usr/bin/env node
/**
 * Update cover_image and images on already-seeded tours.
 * Matches existing tours by title.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const IMAGES_BY_TITLE = {
  'Musandam Dhow Cruise': {
    cover: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=1200&q=80',
      'https://images.unsplash.com/photo-1591025207163-942350e47db2?w=1200&q=80',
      'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1200&q=80',
    ],
  },
  'Ras al-Jinz Turtle Night': {
    cover: 'https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=1200&q=80',
      'https://images.unsplash.com/photo-1591025207163-942350e47db2?w=1200&q=80',
    ],
  },
  'Muscat Heritage Trail': {
    cover: 'https://images.unsplash.com/photo-1591608971362-f08b2a75731a?w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1591608971362-f08b2a75731a?w=1200&q=80',
      'https://images.unsplash.com/photo-1626516783050-2fab3c4ea33b?w=1200&q=80',
      'https://images.unsplash.com/photo-1551632811-561732d1e306?w=1200&q=80',
    ],
  },
  'Wahiba Sands Overnight Safari': {
    cover: 'https://images.unsplash.com/photo-1542401886-65d6c61db217?w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1542401886-65d6c61db217?w=1200&q=80',
      'https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=1200&q=80',
      'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1200&q=80',
    ],
  },
  'Nizwa Fort & Souq': {
    cover: 'https://images.unsplash.com/photo-1574236170880-faba57ab2ce4?w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1574236170880-faba57ab2ce4?w=1200&q=80',
      'https://images.unsplash.com/photo-1551632811-561732d1e306?w=1200&q=80',
      'https://images.unsplash.com/photo-1626516783050-2fab3c4ea33b?w=1200&q=80',
    ],
  },
  'Salalah Khareef Magic': {
    cover: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=1200&q=80',
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80',
      'https://images.unsplash.com/photo-1591025207163-942350e47db2?w=1200&q=80',
    ],
  },
  'Wadi Shab Hike & Swim': {
    cover: 'https://images.unsplash.com/photo-1583087253076-5d1315860eb7?w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1583087253076-5d1315860eb7?w=1200&q=80',
      'https://images.unsplash.com/photo-1551918120-9739cb430c6d?w=1200&q=80',
    ],
  },
};

(async () => {
  console.log('🖼️  Updating tour images...\n');
  const { data: tours, error } = await supabase.from('tour_packages').select('id, title');
  if (error) { console.error('Failed to fetch:', error.message); process.exit(1); }

  let updated = 0;
  for (const tour of tours) {
    const match = Object.keys(IMAGES_BY_TITLE).find(key => tour.title.includes(key));
    if (!match) {
      console.log(`  ⚠ no match: ${tour.title.slice(0, 60)}`);
      continue;
    }
    const { cover, images } = IMAGES_BY_TITLE[match];
    const { error: upErr } = await supabase
      .from('tour_packages')
      .update({ cover_image: cover, images, updatedAt: new Date().toISOString() })
      .eq('id', tour.id);
    if (upErr) {
      console.log(`  ✗ ${tour.title.slice(0, 50)} — ${upErr.message}`);
    } else {
      console.log(`  ✓ ${tour.title.slice(0, 50)}`);
      updated++;
    }
  }

  console.log(`\n✅ Done: ${updated} tours updated\n`);
})();
