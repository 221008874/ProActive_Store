// src/pages/AboutUs.jsx — about page.
//
// Layout is InfoPage for the heading/back-link/date block, then the page's own
// content: the mission / vision / values cards and the closing banner.
//
// Fix round 3: the cards carried 👗 👁️ 💎 and the banner carried 🎉. The spec
// forbids emoji — they render differently per platform, cannot be sized with
// the type, and screen readers announce them as their own words ("party
// popper"). They are stroke icons from the same set as the rest of the chrome,
// so they inherit currentColor and the 1.8px weight.
//
// The page-local <StoreFooter /> is gone: StoreChrome renders the footer for
// every route, so the page's own copy produced two footers stacked.

import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import InfoPage from '../components/InfoPage'
import { Button, IconDiamond, IconEye, IconHanger, IconSpark } from '../ui'

// Revision date as content metadata, not a literal in the markup.
const ABOUT_UPDATED_AT = '2026-02-01T00:00:00Z'

export default function AboutUs() {
  const { t, lang } = useLanguage()

  const ar = lang === 'ar'
  const L = (key, en, fallback) => {
    const v = t(key)
    return v && v !== key ? v : (ar ? fallback : en)
  }

  const intro = L(
    'experienceFinest',
    'Fresh styles chosen with care. Every piece earns its place in your wardrobe.',
    'ستايلات مختارة بعناية، بتوصل لبابك.'
  )

  // The copy is unchanged — only the emoji that used to precede each title is
  // gone, replaced by the stroke icon in the same set as the chrome.
  const sections = [
    {
      key: 'ourMission',
      Icon: IconHanger,
      title: L('ourMission', 'Our Mission', 'مهمتنا'),
      description: L('missionDescription', 'Chosen pieces, honest prices, delivered across Egypt.', 'قطع مختارة، أسعار واضحة، وبتوصل لكل مصر.')
    },
    {
      key: 'ourVision',
      Icon: IconEye,
      title: L('ourVision', 'Our Vision', 'رؤيتنا'),
      description: L('visionDescription', 'A wardrobe you can reach from your phone.', 'دولاب تقدر توصله من موبايلك.')
    },
    {
      key: 'ourValues',
      Icon: IconDiamond,
      title: L('ourValues', 'Our Values', 'قيمنا'),
      description: L('valuesDescription', 'Quality you can feel, service you can trust.', 'جودة تحس بيها، وخدمة تثق بيها.')
    }
  ]

  return (
    <>
      <InfoPage
        title={L('aboutUsTitle', 'About Us', 'عنّا')}
        updatedAt={ABOUT_UPDATED_AT}
        contentLang={lang}
        updatedLabel={L('lastUpdated', 'Last updated', 'آخر تحديث')}
        backHref="/home"
        backLabel={L('backToHome', 'Back to home', 'رجوع للرئيسية')}
      >
        <section className="pa-about">
          {sections.map(({ key, Icon, title, description }) => (
            <div key={key} className="pa-about__card">
              <b className="pa-about__card-head">
                <Icon width={22} height={22} aria-hidden="true" />
                {title}
              </b>
              <span>{description}</span>
            </div>
          ))}
        </section>

        <div className="pa-callout pa-about__banner">
          <b className="pa-about__banner-head">
            <IconSpark width={22} height={22} aria-hidden="true" />
            {L('joinOurStory', 'Join Our Story', 'انضم لحكايتنا')}
          </b>
          <p className="pa-subtitle">{intro}</p>
          <Button as={Link} to="/home">
            {L('exploreOurProducts', 'Explore Our Products', 'استكشف منتجاتنا')}
          </Button>
        </div>
      </InfoPage>
    </>
  )
}
