"use client"

import * as React from "react"
import { Link } from "react-router-dom"
import { Button } from "../shadcn/button"
import { Input } from "../shadcn/input"
import { Textarea } from "../shadcn/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../shadcn/tooltip"
import { Globe, Camera, Briefcase, Send, MessageCircle } from "lucide-react"

function Footerdemo() {
  return (
    <footer className="relative border-t border-slate-200 bg-white text-slate-900 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 py-12 md:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <img src="/crew-new.png" alt="Crew HRMS Logo" className="h-14 w-auto object-contain mb-4 drop-shadow-sm" />
            <p className="mb-6 text-slate-500 max-w-sm">
              The modern HRMS built for forward-thinking organizations. Automate payroll, manage leaves, and scale your workforce with zero friction.
            </p>
            <div className="absolute -right-4 top-0 h-24 w-24 rounded-full bg-indigo-100 blur-2xl pointer-events-none" />
          </div>
          <div>
            <h3 className="mb-4 text-lg font-semibold">Quick Links</h3>
            <nav className="space-y-2 text-sm">
              <Link to="/" className="block transition-colors hover:text-indigo-600 text-slate-600">
                Home
              </Link>
              <Link to="/jobs" className="block transition-colors hover:text-indigo-600 text-slate-600">
                Jobs
              </Link>
              <Link to="/signup" className="block transition-colors hover:text-indigo-600 text-slate-600">
                Sign Up
              </Link>
              <Link to="/login" className="block transition-colors hover:text-indigo-600 text-slate-600">
                Login
              </Link>
            </nav>
          </div>
          <div>
            <h3 className="mb-4 text-lg font-semibold">Contact Us</h3>
            <address className="space-y-2 text-sm not-italic text-slate-600">
              <p>Crew HQ, 4th Floor</p>
              <p>Koramangala, Bengaluru 560034</p>
              <p>Phone: +91 (800) 123-CREW</p>
              <p>Email: hrms.crew@gmail.com</p>
            </address>
          </div>
          <div className="relative">
            <h3 className="mb-4 text-lg font-semibold">Follow Us</h3>
            <div className="mb-6 flex space-x-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-full">
                      <Globe className="h-4 w-4" />
                      <span className="sr-only">Facebook</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Follow us on Facebook</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-full">
                      <MessageCircle className="h-4 w-4" />
                      <span className="sr-only">Twitter</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Follow us on Twitter</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-full">
                      <Camera className="h-4 w-4" />
                      <span className="sr-only">Instagram</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Follow us on Instagram</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-full">
                      <Briefcase className="h-4 w-4" />
                      <span className="sr-only">LinkedIn</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Connect with us on LinkedIn</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 text-center md:flex-row">
          <p className="text-sm text-slate-500">
            © 2026 Crew HRMS. All rights reserved.
          </p>
          <nav className="flex gap-4 text-sm text-slate-600">
            <a href="#" className="transition-colors hover:text-accent-primary">
              Privacy Policy
            </a>
            <a href="#" className="transition-colors hover:text-accent-primary">
              Terms of Service
            </a>
            <a href="#" className="transition-colors hover:text-accent-primary">
              Cookie Settings
            </a>
          </nav>
        </div>
      </div>
    </footer>
  )
}

export { Footerdemo }

