import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Heart, Compass, Eye, MessageSquare, Award, Quote } from 'lucide-react';

const About = () => {
  const pageContainerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2 } },
  };

  const sectionVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  };

  return (
    <div className="bg-black min-h-screen text-gray-300 py-12 px-4 sm:px-6 lg:px-8 overflow-hidden select-none">
      <Helmet>
        <title>About Us | SMKP TRADERS</title>
        <meta name="description" content="Learn about the inspiring story, mission, and vision of SMKP Traders, built with dedication, coding expertise, and traditional values by a student founder." />
      </Helmet>

      <motion.div
        variants={pageContainerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-5xl mx-auto space-y-12 sm:space-y-16"
      >
        {/* Header Hero */}
        <motion.div variants={sectionVariants} className="text-center space-y-3 pb-6 border-b border-yellow-900/10">
          <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[10px] font-black uppercase tracking-[0.3em] px-4 py-1.5 rounded-full">
            Our Legacy & Journey
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight uppercase">
            About SMKP Traders
          </h1>
          <p className="max-w-2xl mx-auto text-xs sm:text-sm text-gray-500 font-medium leading-relaxed uppercase tracking-wider">
            Blending technology with traditional values to create happiness, build trust, and deliver absolute premium quality.
          </p>
        </motion.div>

        {/* 1. Our Story Section */}
        <motion.div variants={sectionVariants} className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-7 space-y-4">
            <div className="flex items-center gap-3">
              <Award className="text-yellow-500 shrink-0" size={20} />
              <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-widest">Our Story</h2>
            </div>
            <div className="space-y-3 text-xs sm:text-sm leading-relaxed text-gray-400 font-medium">
              <p>
                SMKP Traders is not just an online store; it is the manifestation of a dream built from code, persistence, and determination. Our founder, a dedicated college student pursuing his Master of Computer Applications (MCA), set out to build something that would make a difference. 
              </p>
              <p>
                Coming from a simple, hard-working family, high-end investment capital was out of reach. But instead of waiting for the "perfect opportunity" or looking for sponsors, he utilized his learning. Armed with text editors, frameworks, and an unshakeable belief, he sat down to write the lines of code that would become this e-commerce platform.
              </p>
              <p>
                Every bug resolved, every server deployment, and every product sourced became a valuable lesson. Every single listing on this website represents hours of self-guided studies, trials, and hard work. Our core goal goes far beyond transactions; it is about bringing genuine happiness to children with premium toys and establishing a circle of absolute trust for parents.
              </p>
            </div>
          </div>
          <div className="md:col-span-5">
            <div className="relative p-6 bg-gray-900/40 backdrop-blur-xl border border-yellow-900/15 rounded-[2rem] overflow-hidden flex flex-col justify-center min-h-[220px] shadow-lg">
              <div className="absolute top-4 right-6 text-yellow-500/10" aria-hidden="true">
                <Quote size={80} strokeWidth={1} />
              </div>
              <p className="text-sm font-black text-white uppercase tracking-wider mb-2">A Student's Dream</p>
              <p className="text-xs text-gray-500 leading-relaxed font-medium">
                "I didn't have a budget to hire builders or marketers. All I had was a keyboard, a screen, and a vision of building a transparent shop for local families. This platform is my tribute to the power of self-taught learning."
              </p>
              <div className="mt-4 pt-3 border-t border-yellow-900/10">
                <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Kaviyarasan M.</p>
                <p className="text-[8px] text-gray-600 font-bold uppercase tracking-wider">MCA Student & Founder</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 2 & 3. Mission & Vision Grid */}
        <motion.div variants={sectionVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {/* Mission */}
          <div className="bg-gray-900/40 backdrop-blur-xl border border-yellow-900/15 rounded-3xl p-6 sm:p-8 space-y-4 hover:border-yellow-500/20 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-xl border border-yellow-500/20 text-yellow-500">
                <Compass size={20} />
              </div>
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-widest">Our Mission</h2>
            </div>
            <ul className="space-y-3.5">
              {[
                { title: 'Quality Products', desc: 'Only sourcing safety-certified, premium items.' },
                { title: 'Affordable Pricing', desc: 'Cutting middleman markups to provide the best value.' },
                { title: 'Honest Business', desc: 'Transparent policies, zero hidden costs, and truth in marketing.' },
                { title: 'Customer Trust', desc: 'Focusing on building long-term family relationships over quick sales.' }
              ].map((item, idx) => (
                <li key={idx} className="flex gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1.5 shrink-0 animate-pulse" />
                  <div className="text-xs sm:text-sm">
                    <strong className="text-white font-black uppercase tracking-wider block sm:inline mr-1">{item.title}:</strong>
                    <span className="text-gray-400 font-medium">{item.desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Vision */}
          <div className="bg-gray-900/40 backdrop-blur-xl border border-yellow-900/15 rounded-3xl p-6 sm:p-8 space-y-4 hover:border-yellow-500/20 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-xl border border-yellow-500/20 text-yellow-500">
                <Eye size={20} />
              </div>
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-widest">Our Vision</h2>
            </div>
            <ul className="space-y-3.5">
              {[
                { title: 'India\'s Trusted Toy Hub', desc: 'To stand as one of the most reliable online family store brands.' },
                { title: 'Learning Through Play', desc: 'Focusing heavily on educational, creative, and puzzle-based toys.' },
                { title: 'Blending Tech & Traditions', desc: 'Adapting modern delivery and security with traditional Indian ethics.' },
                { title: 'Local Empowerment', desc: 'Sourcing and supporting traditional Indian artisans alongside tech toys.' }
              ].map((item, idx) => (
                <li key={idx} className="flex gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1.5 shrink-0 animate-pulse" />
                  <div className="text-xs sm:text-sm">
                    <strong className="text-white font-black uppercase tracking-wider block sm:inline mr-1">{item.title}:</strong>
                    <span className="text-gray-400 font-medium">{item.desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>

        {/* 4. Founder Message Section */}
        <motion.div variants={sectionVariants} className="bg-gray-900/40 backdrop-blur-xl border border-yellow-900/15 rounded-[2.2rem] p-6 sm:p-10 relative overflow-hidden">
          <div className="absolute -bottom-8 -right-8 text-yellow-500/5 select-none pointer-events-none" aria-hidden="true">
            <Heart size={160} strokeWidth={1} />
          </div>
          <div className="max-w-3xl space-y-4 relative z-10">
            <div className="flex items-center gap-3">
              <MessageSquare className="text-yellow-500" size={20} />
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-widest">A Heartfelt Message</h2>
            </div>
            <blockquote className="text-xs sm:text-sm text-gray-300 font-medium leading-relaxed italic border-l-2 border-yellow-500/40 pl-4 py-1">
              "To every parent, grandparent, and customer who visits our store: thank you. When I started coding this website late at night between college classes, I wasn't sure if anyone would buy a single product. Today, every order we pack and ship is a reminder that sincerity finds its way. Your support is not just sales; it feeds our passion and pays the wages of our hard work. We pledge to keep improving, selecting products that delight your kids and maintaining the absolute honesty you deserve."
            </blockquote>
            <div className="pt-2 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center font-black text-yellow-500 text-xs shadow-md">
                KM
              </div>
              <div>
                <p className="text-[10px] font-black text-white uppercase tracking-widest">Kaviyarasan Murugan</p>
                <p className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">Founder, SMKP Traders</p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default About;
