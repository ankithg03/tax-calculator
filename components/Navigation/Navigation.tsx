'use client'
import Link from "next/link";
import { useState } from "react";

const Navigation = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
  
    const toggleMenu = () => {
      setIsMenuOpen(!isMenuOpen);
    };
  
    return (
      <nav className="bg-[#021522] text-white font-maven-pro">
        {/* Desktop Navigation */}
        <div className="hidden md:block">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-8">
                <Link href="/" className="text-lg font-semibold hover:text-blue-200 transition-colors">
                In<span className="text-blue-500">Tax</span>Calc
                </Link>
                <Link href="https://github.com/ankithg03" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">
                  Github
                </Link>
              </div>
              <div className="flex items-center space-x-4">
                <Link 
                  href={'https://ankithg.vercel.app/'}
                  target="_blank"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                  Portfolio
                </Link>
              </div>
            </div>
          </div>
        </div>
  
        {/* Mobile Navigation */}
        <div className="md:hidden">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Link href="/" className="text-gray-300 hover:text-white transition-colors">
                In<span className="text-blue-500">Tax</span>Calc
                </Link>
              </div>
              <button 
                onClick={toggleMenu}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm"
              >
                Menu
              </button>
            </div>
            
            {/* Mobile Menu Dropdown */}
            {isMenuOpen && (
              <div className="mt-4 py-2 space-y-2 border-t border-gray-700">
                <Link 
                  href="https://github.com/ankithg03" 
                  target="_blank"
                  className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Github
                </Link>
                
                <Link 
                  className="px-4 py-2 mt-2  bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm flex"
                  onClick={() => setIsMenuOpen(false)}
                  href={'https://ankithg.vercel.app/'}
                >
                  Portfolio
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>
    );
  }
  
  export default Navigation;