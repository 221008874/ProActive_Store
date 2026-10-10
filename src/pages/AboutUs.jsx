// src/pages/AboutUs.jsx — ProActive Fashion design system refactor.
//
// Content is unchanged: the mission / vision / values cards and the closing
// copy still resolve through the translation table, and both navigation
// handlers still go to /home. Presentation moved to the design system —
// PageTitle, .pa-about cards, .pa-callout and StoreFooter. The windowWidth
// state, the floating decorative blobs, the page-local header (the app shell
// renders chrome now) and the keyframe block are gone: breakpoints live in
// CSS and motion is governed by the tokens.css prefers-reduced-motion gate.

import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import StoreFooter from '../components/StoreFooter'
import { Button, PageTitle } from '../ui'

export default function AboutUs() {
  const { t, lang } = useLanguage()
  const navigate = useNavigate()

  const ar = lang === 'ar'
  const L = (key, en, fallback) => {
    const v = t(key)
    return v && v !== key ? v : (ar ? fallback : en)
  }

  const intro = L(
    'experienceFinest',
    'Experience the finest chocolates crafted with love and dedication. Every piece tells a story of quality and passion.',
    'تجربة أشهى الشوكولاتة المصنوعة بحب وإتقان. كل قطعة تحكي قصة جودة وشغف.'
  )

  const sections = [
    {
      icon: '🍫',
      title: L('ourMission', 'Our Mission', 'مهمتنا'),
      description: L('missionDescription', 'Chosen pieces, honest prices, delivered across Egypt.', 'قطع مختارة، أسعار واضحة، وبتوصل لكل مصر.')
    },
    {
      icon: '👁️',
      title: L('ourVision', 'Our Vision', 'رؤيتنا'),
      description: L('visionDescription', 'A wardrobe you can reach from your phone.', 'دولاب تقدر توصله من موبايلك.')
    },
    {
      icon: '💎',
      title: L('ourValues', 'Our Values', 'قيمنا'),
      description: L('valuesDescription', 'Quality you can feel, service you can trust.', 'جودة تحس بيها، وخدمة تثق بيها.')
    }
  ]

  return (
    <>
      <PageTitle
        title={L('aboutUsTitle', 'About Us', 'عنّا')}
        subtitle={intro}
        actions={
          <Button variant="outline" onClick={() => navigate('/home')}>
            {L('backToHome', 'Back to home', 'رجوع للرئيسية')}
          </Button>
        }
      />

      <section className="pa-about">
        {sections.map((section) => (
          <div key={section.title} className="pa-about__card">
            <b>{section.icon} {section.title}</b>
            <span>{section.description}</span>
          </div>
        ))}
      </section>

      <div className="pa-container" style={{ paddingBlock: 20 }}>
        <div className="pa-callout" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
          <b style={{ fontSize: 18 }}>🎉 {L('joinOurSweetJourney', 'Join Our Sweet Journey', 'انضم لرحلتنا الحلوة')}</b>
          <p className="pa-subtitle" style={{ margin: 0, maxWidth: 640 }}>{intro}</p>
          <Button onClick={() => navigate('/home')}>
            {L('exploreOurProducts', 'Explore Our Products', 'استكشف منتجاتنا')}
          </Button>
        </div>
      </div>

      <StoreFooter />
    </>
  )
}
