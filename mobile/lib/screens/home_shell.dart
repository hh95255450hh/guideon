import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'search_screen.dart';
import 'trip_planner_screen.dart';
import 'bookings_screen.dart';
import 'account_screen.dart';

/// Bottom-nav container: Search · Plan · Bookings · Account.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    const pages = [
      SearchScreen(),
      TripPlannerScreen(),
      BookingsScreen(),
      AccountScreen(),
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        indicatorColor: GdColors.teal.withValues(alpha: .12),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.search), label: 'ابحث'),
          NavigationDestination(
              icon: Icon(Icons.auto_awesome_outlined),
              selectedIcon: Icon(Icons.auto_awesome),
              label: 'خطّط'),
          NavigationDestination(
              icon: Icon(Icons.calendar_month_outlined), label: 'حجوزاتي'),
          NavigationDestination(
              icon: Icon(Icons.person_outline), label: 'حسابي'),
        ],
      ),
    );
  }
}
