import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Heart, Compass, Eye, MessageSquare, Award, BookOpen, Quote, ShieldCheck, Zap } from 'lucide-react';

const kuralsList = [
  {
    number: 391,
    tamil: "கற்க கசடறக் கற்பவை கற்றபின்\nநிற்க அதற்குத் தக.",
    tamilMeaning: "கற்கத் தகுந்தவைகளைக் குற்றம் இல்லாமல் கற்க வேண்டும். கற்ற பிறகு, கற்ற கல்வியின் வழிப்படியே ஒழுக்கத்துடன் வாழ வேண்டும்.",
    english: "Learn thoroughly what is worthy of learning, and after learning, live in accordance with that education.",
    whyMatches: "As a student-led venture, we believe continuous learning is the bedrock of success. We constantly study technology and design to build a platform that serves you with excellence and integrity."
  },
  {
    number: 619,
    tamil: "தெய்வத்தான் ஆகா தெனினும் முயற்சிதன்\nமெய்வருத்தக் கூலி தரும்.",
    tamilMeaning: "கடவுளின் விதிப்படியால் ஒரு காரியம் முடியாது என்றாலும், முயற்சி தன் உடம்பால் உழைத்துச் செய்த உழைப்பின் அளவிற்குப் பயன் தரும்.",
    english: "Even if divinity cannot accomplish a task, honest hard work and effort will pay its wages.",
    whyMatches: "Started on a student's shoestring budget, our platform was built not through giant investments, but through pure, relentless effort and self-taught coding. Hard work is our greatest currency."
  },
  {
    number: 291,
    tamil: "வாய்மை எனப்படுவது யாதெனின் யாதொன்றும்\nதீமை இலாத சொலல்.",
    tamilMeaning: "வாய்மை என்று சொல்லப்படுவது எதுவென்றால், மற்றவர்களுக்கு எவ்வகையிலும் சிறிதும் தீமை தராத சொற்களைச் சொல்லுதல் ஆகும்.",
    english: "Truthfulness is defined as speaking words that are completely free from any harm to others.",
    whyMatches: "Honesty and truthfulness guide every product selection and pricing model we choose. We stand for transparency, ensuring parents get safe products and fair values without hidden tricks."
  },
  {
    number: 595,
    tamil: "வெள்ளத் தனைய மலர்நீட்டம் மாந்தர்தம்\nஉள்ளத் தனையது உயர்வு.",
    tamilMeaning: "நீர்ப்பூக்களின் தாளின் நீளம் அவை நிற்கும் நீரின் அளவைப் பொறுத்தது; மனிதர்களின் உயர்வு அவர்களின் மன ஊக்கத்தின் அளவைப் பொறுத்தது.",
    english: "The height of a water lily depends on the water depth; a person's height of success depends on their mental resolve.",
    whyMatches: "Our limits are only defined by our imagination and resolve. From a simple student room to an online store serving families nationwide, our growth is powered by our passion."
  },
  {
    number: 611,
    tamil: "அருமை உடைத்தென்றல் காண்டல் அறிவுடையார்\nஉள்ளம் தளராமை வேண்டும்.",
    tamilMeaning: "இச்செயல் செய்வதற்கு அருமையானது என்று சோர்வடையாமல், அதைச் செய்து முடிக்கும் வல்லமை உடைய சோர்விலா உள்ளம் வேண்டும்.",
    english: "To not shrink back from a task saying 'it is too difficult' is the wisdom; resolve to persevere without flagging is what is needed.",
    whyMatches: "Building an e-commerce platform single-handedly while pursuing an MCA degree was challenging, but we persevered. We believe no mountain is too high if you move one stone at a time."
  },
  {
    number: 131,
    tamil: "ஒழுக்கம் விழுப்பம் தரலான் ஒழுக்கம்\nஉயிரினும் ஓம்பப் படும்.",
    tamilMeaning: "ஒழுக்கம் ஒருவனுக்கு மேன்மையைத் தருவதால், அந்த ஒழுக்கத்தை உயிரை விடவும் மேலானதாகப் போற்றிப் பாதுகாக்க வேண்டும்.",
    english: "Because good conduct brings excellence, it should be protected and preserved as more precious than life itself.",
    whyMatches: "For us, business ethics is not just a policy; it is our soul. We prioritize safety, quality, and fair dealing as values that we protect more than profit."
  },
  {
    number: 78,
    tamil: "அன்பின் வழியது உயிர்நிலை அஃதிலார்க்கு\nஎன்புதோல் போர்த்த உடம்பு.",
    tamilMeaning: "அன்பின் வழியில் இயங்குவதே உயிருள்ள உடலாகும்; அன்பு இல்லாதவர்களின் உடல் வெறும் எலும்பும் தோலும் போர்த்திய வெறும் கூடு போன்றதே.",
    english: "A body driven by love is the seat of life; for those devoid of love, their body is but bones covered with skin.",
    whyMatches: "Our store isn't about numbers or orders; it is about bringing smiles to children and peace of mind to parents. Every packing box is sent with a portion of care and love."
  }
];

const About = () => {
  // Get today's Kural deterministically
  const dailyKural = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), 0, 0);
    const diff = today - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    const index = dayOfYear % kuralsList.length;
    return kuralsList[index];
  }, []);

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

        {/* 5. Company Journey Thirukkural (Permanent) */}
        <motion.div variants={sectionVariants} className="bg-slate-950 border border-yellow-500/15 rounded-3xl p-6 sm:p-8 relative">
          <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-yellow-500/10 text-yellow-500 border border-yellow-500/25 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider shadow-[0_0_12px_rgba(234,179,8,0.1)]">
            <BookOpen size={10} /> Journey Pillar Kural
          </div>
          <div className="pt-6 space-y-5 text-center">
            {/* Kural text */}
            <div className="bg-black/50 p-4 rounded-2xl border border-yellow-900/10 inline-block mx-auto max-w-full">
              <p className="text-sm sm:text-base font-black text-yellow-400 font-serif leading-relaxed whitespace-pre-line tracking-wide">
                தெய்வத்தான் ஆகா தெனினும் முயற்சிதன்<br />
                மெய்வருத்தக் கூலி தரும்.
              </p>
              <p className="text-[9px] font-mono text-gray-600 mt-2">அதிகாரம்: ஆள்வினையுடைமை (Kural 619)</p>
            </div>

            {/* Meanings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left max-w-4xl mx-auto pt-2">
              <div className="bg-gray-900/40 p-4 rounded-xl border border-white/5 space-y-1">
                <span className="text-[8px] font-black text-yellow-500 uppercase tracking-widest">தமிழ் உரை:</span>
                <p className="text-xs text-gray-300 font-medium leading-relaxed">
                  கடவுளின் அருள் இல்லாவிட்டாலும், ஒருவன் தன் உடலால் உழைத்துச் செய்யும் முயற்சியானது அதற்குரிய பலனை நிச்சயம் தரும்.
                </p>
              </div>
              <div className="bg-gray-900/40 p-4 rounded-xl border border-white/5 space-y-1">
                <span className="text-[8px] font-black text-yellow-500 uppercase tracking-widest">English Transliteration:</span>
                <p className="text-xs text-gray-300 font-medium leading-relaxed">
                  Even if divine aid is unavailable, one's own persistent physical effort and hard work will yield its deserved reward.
                </p>
              </div>
            </div>

            {/* Relevance */}
            <div className="bg-gray-900/40 p-5 rounded-2xl border border-yellow-500/10 text-left max-w-4xl mx-auto space-y-2">
              <span className="text-[8px] font-black text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap size={11} className="text-yellow-500 animate-pulse" /> Why this Kural matches our journey:
              </span>
              <p className="text-xs text-gray-400 font-medium leading-relaxed">
                This Kural encapsulates the very essence of SMKP Traders. Our founder, a young MCA student, did not wait for a perfect market opportunity or huge investment budgets. Coming from a simple family with limited resources, he invested his sweat, learning, and hours of coding to build this e-commerce platform. When financial doors seemed closed, his sheer personal effort and hard work became the engine that drove this project forward. Every feature on this site, and every product in our store, is a testimony to the truth of this Kural: that sincere self-effort pays its wages in success, regardless of the odds.
              </p>
            </div>
          </div>
        </motion.div>

        {/* 6. Dynamic Daily Thirukkural (Rotating) */}
        <motion.div variants={sectionVariants} className="bg-gray-900/30 border border-white/5 rounded-3xl p-6 sm:p-8 relative">
          <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-yellow-500/5 text-yellow-600 border border-yellow-500/10 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider">
            <BookOpen size={10} /> Dynamic Daily Wisdom
          </div>
          <div className="pt-6 space-y-5 text-center">
            {/* Kural text */}
            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 inline-block mx-auto max-w-full">
              <p className="text-xs sm:text-sm font-bold text-gray-200 font-serif leading-relaxed whitespace-pre-line tracking-wide">
                {dailyKural.tamil}
              </p>
              <p className="text-[8px] font-mono text-gray-600 mt-2">Kural {dailyKural.number}</p>
            </div>

            {/* Meanings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left max-w-4xl mx-auto pt-2">
              <div className="bg-black/20 p-4 rounded-xl border border-white/5 space-y-1">
                <span className="text-[8px] font-black text-yellow-500/80 uppercase tracking-widest">தமிழ் உரை:</span>
                <p className="text-xs text-gray-400 font-medium leading-relaxed">{dailyKural.tamilMeaning}</p>
              </div>
              <div className="bg-black/20 p-4 rounded-xl border border-white/5 space-y-1">
                <span className="text-[8px] font-black text-yellow-500/80 uppercase tracking-widest">English Meaning:</span>
                <p className="text-xs text-gray-400 font-medium leading-relaxed">{dailyKural.english}</p>
              </div>
            </div>

            {/* Relevance */}
            <div className="bg-black/20 p-5 rounded-2xl border border-yellow-500/10 text-left max-w-4xl mx-auto space-y-2">
              <span className="text-[8px] font-black text-yellow-500/80 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={11} className="text-yellow-600" /> Alignment with our values:
              </span>
              <p className="text-xs text-gray-400 font-medium leading-relaxed">{dailyKural.whyMatches}</p>
            </div>
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
};

export default About;
