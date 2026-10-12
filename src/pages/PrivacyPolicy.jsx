// src/pages/PrivacyPolicy.jsx — privacy policy.
//
// Layout is InfoPage: one container, one reading column, a text back-link above
// the title and a date that comes from the document's own metadata rather than
// a literal in the markup. See components/InfoPage.jsx for why the previous
// hand-rolled version clipped in RTL.
//
// P1.10 (owner action, not a code change): the copy below still describes a
// store that collects only cart contents and mentions only Firebase. The store
// now collects name, phone, delivery address, map location and order history,
// and uses Vercel, Cloudinary and Firebase. Someone with the authority to
// publish policy needs to rewrite `informationWeCollect` and `dataSharing` in
// src/i18n/strings.js. See docs/PRIVACY_POLICY_REVIEW.md.

import { useLanguage } from '../context/LanguageContext'
import InfoPage from '../components/InfoPage'

// The policy's revision date. Content metadata, not a literal: when the text
// changes, this is the line that has to change with it, and having it in one
// obvious place is the only way it ever does.
const POLICY_UPDATED_AT = '2026-02-01T00:00:00Z'

export default function PrivacyPolicy() {
  const { t, lang } = useLanguage()

  const ar = lang === 'ar'
  const L = (key, en, fallback) => {
    const v = t(key)
    return v && v !== key ? v : (ar ? fallback : en)
  }

  const sections = [
    {
      key: 'informationWeCollect',
      title: L('informationWeCollect', 'Information We Collect', 'المعلومات اللي بنجمعها'),
      body: L('infoCollectionText', 'We collect information when you use our app, such as products added to your cart and order details. We do not collect any sensitive personal information.', 'بنجمع معلومات لما تستخدم التطبيق، زي المنتجات اللي بتضاف للعربية وتفاصيل الطلب. مش بنجمع أي معلومات شخصية حساسة.')
    },
    {
      key: 'howWeUseInfo',
      title: L('howWeUseInfo', 'How We Use Your Information', 'إزاي بنستخدم معلوماتك'),
      body: L('useInfoText', 'We use the collected information to improve your shopping experience, show relevant products, and provide technical support.', 'بنستخدم المعلومات اللي اجتمعناها عشان نحسّن تجربة التسوق، نعرض منتجات مناسبة، وندعمك فنياً.')
    },
    {
      key: 'dataSharing',
      title: L('dataSharing', 'Data Sharing', 'مشاركة البيانات'),
      body: L('dataSharingText', 'We do not share your data with any third parties. All information is securely stored in our Firebase databases.', 'مبنشاركش بياناتك مع أي طرف تاني. كل المعلومات محفوظة بشكل آمن في قواعد بيانات Firebase.')
    },
    {
      key: 'dataSecurity',
      title: L('dataSecurity', 'Data Security', 'أمان البيانات'),
      body: L('securityText', 'We follow industry best practices to protect your data from unauthorized access, alteration, disclosure, or destruction.', 'بنتبع أفضل الممارسات عشان نحمي بياناتك من أي وصول أو تعديل أو إفصاح أو إتلاف غير مصرح بيه.')
    },
    {
      key: 'yourRights',
      title: L('yourRights', 'Your Rights', 'حقوقك'),
      body: L('rightsText', 'You have the right to request deletion or correction of your data at any time by contacting us.', 'من حقك تطلب حذف أو تصحيح بياناتك في أي وقت عن طريق التواصل معانا.')
    },
    {
      key: 'contactUs',
      title: L('contactUs', 'Contact Us', 'تواصل معانا'),
      body: L('contactPrivacyText', 'For any questions about this Privacy Policy, please email us at: proactive.store.eg@gmail.com', 'لو عندك أي أسئلة عن سياسة الخصوصية، ابعتلنا على: proactive.store.eg@gmail.com')
    }
  ]

  return (
    <InfoPage
      title={L('privacyPolicy', 'Privacy Policy', 'سياسة الخصوصية')}
      updatedAt={POLICY_UPDATED_AT}
      contentLang={lang}
      updatedLabel={L('lastUpdated', 'Last updated', 'آخر تحديث')}
      backHref="/home"
      backLabel={L('backToHome', 'Back to home', 'رجوع للرئيسية')}
    >
      {sections.map((section) => (
        <section key={section.key} className="pa-info__section">
          <h2>{section.title}</h2>
          <p>{section.body}</p>
        </section>
      ))}
    </InfoPage>
  )
}
