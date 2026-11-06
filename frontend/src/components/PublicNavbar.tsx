import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sparkles, ArrowRight, Menu, X, BookOpen, Headphones } from 'lucide-react';
import { Button } from './ui/button';
import { ThemeToggle } from './ThemeToggle';

export const PublicNavbar: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const navLinks = [
    { label: 'Demo', href: '/#demo', isAnchor: true },
    { label: 'Features', href: '/#features', isAnchor: true },
    { label: 'Architecture', href: '/#architecture', isAnchor: true },
    { label: 'Docs', href: '/docs', isAnchor: false, icon: BookOpen },
    { label: 'Contact', href: '/contact', isAnchor: false, icon: Headphones },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full backdrop-blur-md bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 shadow-2xs transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo (Left) */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 via-violet-600 to-purple-700 text-white shrink-0 shadow-md shadow-purple-500/25 transition-transform duration-300 group-hover:scale-105">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="font-black text-xl tracking-tight bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 dark:from-white dark:via-purple-200 dark:to-white bg-clip-text text-transparent">
              CORE
            </span>
          </Link>
        </div>

        {/* Desktop Navigation Links (Center) */}
        <nav className="hidden md:flex items-center justify-center gap-1 sm:gap-2 lg:gap-3 text-xs sm:text-sm font-semibold">
          {navLinks.map((item) => {
            const active = !item.isAnchor && isActive(item.href);
            return item.isAnchor ? (
              <a
                key={item.label}
                href={location.pathname === '/' ? item.href.replace('/', '') : item.href}
                className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.label}
                to={item.href}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  active
                    ? 'text-primary dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Action Buttons (Right) */}
        <div className="hidden md:flex items-center gap-2 lg:gap-3">
          <ThemeToggle />
          {user ? (
            <Link to="/dashboard">
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-white font-bold shadow-md shadow-primary/20 px-4 text-xs h-9 transition-all duration-200 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5">
                Launch Workspace
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm" className="text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs h-9 transition-colors">
                  Sign In
                </Button>
              </Link>
              <Link to="/signup">
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-white font-bold shadow-md shadow-primary/25 px-4 text-xs h-9 transition-all duration-200 hover:shadow-lg hover:shadow-primary/35 hover:-translate-y-0.5">
                  Get Started Free
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Header Controls */}
        <div className="flex md:hidden items-center gap-1.5">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-2 pb-6 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col space-y-1">
            {navLinks.map((item) => {
              const active = !item.isAnchor && isActive(item.href);
              return item.isAnchor ? (
                <a
                  key={item.label}
                  href={location.pathname === '/' ? item.href.replace('/', '') : item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.label}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-between ${
                    active
                      ? 'bg-purple-50 dark:bg-purple-950/60 text-primary dark:text-purple-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="pt-2 pb-1 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span>Theme Appearance</span>
            <ThemeToggle showLabel className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
            {user ? (
              <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs h-9 shadow-md">
                  Launch Workspace
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full text-xs font-bold h-9">
                    Sign In
                  </Button>
                </Link>
                <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs h-9 shadow-md">
                    Get Started Free
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
