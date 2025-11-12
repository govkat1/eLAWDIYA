'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userType, setUserType] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('auth_token');
    const savedUserType = localStorage.getItem('user_type');

    if (token) {
      setIsLoggedIn(true);
      setUserType(savedUserType);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-2xl font-bold text-blue-600">eLAWDIYA</h1>
                <span className="ml-2 text-sm text-gray-500">Traffic Violation Reporting</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {isLoggedIn ? (
                <>
                  <Link
                    href={userType === 'admin' || userType === 'super_admin' ? "/admin/dashboard" : "/dashboard"}
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/report"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    Report Violation
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="relative z-10 pb-8 bg-transparent sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
            <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
              <div className="sm:text-center lg:text-left">
                <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
                  <span className="block xl:inline">Traffic Violation</span>{' '}
                  <span className="block text-blue-600 xl:inline">Reporting System</span>
                </h1>
                <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                  Empowering citizens to report traffic violations with AI-powered vehicle detection.
                  Help make our roads safer with real-time reporting and automated verification.
                </p>
                <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                  <div className="rounded-md shadow">
                    <Link
                      href={isLoggedIn ? "/report" : "/register"}
                      className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10"
                    >
                      {isLoggedIn ? 'Report Now' : 'Get Started'}
                    </Link>
                  </div>
                  <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
                    <Link
                      href="/shame"
                      className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-blue-600 bg-white hover:bg-gray-50 md:py-4 md:text-lg md:px-10"
                    >
                      Hall of Shame
                    </Link>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
        <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
          <div className="h-56 w-full bg-gradient-to-r from-blue-400 to-indigo-500 sm:h-72 md:h-96 lg:w-full lg:h-full flex items-center justify-center">
            <div className="text-center text-white p-8">
              <div className="text-6xl mb-4">🚗🏍️</div>
              <h2 className="text-2xl font-bold mb-2">AI-Powered Detection</h2>
              <p className="text-lg">Real-time vehicle detection and violation reporting</p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-blue-600 font-semibold tracking-wide uppercase">Features</h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to report traffic violations
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
              Our system uses cutting-edge AI technology to detect and verify traffic violations automatically.
            </p>
          </div>

          <div className="mt-10">
            <div className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-x-8 md:gap-y-10">
              {/* Feature 1 */}
              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                  <span className="text-xl">📸</span>
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                  Smart Vehicle Detection
                </p>
                <p className="mt-2 ml-16 text-base text-gray-500">
                  Advanced AI automatically detects cars and bikes in your photos with high accuracy.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                  <span className="text-xl">📍</span>
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                  GPS Location Tagging
                </p>
                <p className="mt-2 ml-16 text-base text-gray-500">
                  Automatically captures location data for accurate violation reporting.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                  <span className="text-xl">🏆</span>
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                  Reward System
                </p>
                <p className="mt-2 ml-16 text-base text-gray-500">
                  Earn points for verified reports and climb the leaderboard.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                  <span className="text-xl">🔍</span>
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                  Admin Verification
                </p>
                <p className="mt-2 ml-16 text-base text-gray-500">
                  All reports are reviewed by authorized administrators for verification.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                  <span className="text-xl">📊</span>
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                  Hall of Shame
                </p>
                <p className="mt-2 ml-16 text-base text-gray-500">
                  Public transparency dashboard showing repeat offenders and violation statistics.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                  <span className="text-xl">📱</span>
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                  Mobile Friendly
                </p>
                <p className="mt-2 ml-16 text-base text-gray-500">
                  Works seamlessly on all devices - phones, tablets, and desktops.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-blue-600">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-white">500+</div>
              <div className="mt-2 text-lg text-blue-200">Violations Reported</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-white">95%</div>
              <div className="mt-2 text-lg text-blue-200">Detection Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-white">24/7</div>
              <div className="mt-2 text-lg text-blue-200">Monitoring</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-white">100%</div>
              <div className="mt-2 text-lg text-blue-200">User Satisfaction</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <h3 className="text-white text-lg font-semibold mb-4">eLAWDIYA</h3>
              <p className="text-gray-300 text-sm">
                Making our roads safer through community-powered traffic violation reporting
                and AI-powered detection technology.
              </p>
            </div>
            <div>
              <h4 className="text-white text-sm font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li><Link href="/report" className="text-gray-300 hover:text-white text-sm">Report Violation</Link></li>
                <li><Link href="/shame" className="text-gray-300 hover:text-white text-sm">Hall of Shame</Link></li>
                <li><Link href="/leaderboard" className="text-gray-300 hover:text-white text-sm">Leaderboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white text-sm font-semibold mb-4">Support</h4>
              <ul className="space-y-2">
                <li><Link href="/login" className="text-gray-300 hover:text-white text-sm">Login</Link></li>
                <li><Link href="/register" className="text-gray-300 hover:text-white text-sm">Sign Up</Link></li>
                <li><a href="#" className="text-gray-300 hover:text-white text-sm">Help Center</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-700 pt-8">
            <p className="text-gray-300 text-center text-sm">
              © 2024 eLAWDIYA Traffic Violation Reporting System. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
