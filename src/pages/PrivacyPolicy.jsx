// src/pages/PrivacyPolicy.jsx — ProActive Fashion design system refactor.
//
// Content is unchanged: the same six policy sections still resolve through the
// translation table and the "last updated" date is the same literal. The
// page-local header is gone (the app shell renders chrome), the back-to-home
// handler survives on a design-system outline button, and the ~900px card is
// now a full-bleed .pa-block band with a centred .pa-container measure.

import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import StoreFooter from '../components/StoreFooter'
import { Button, PageTitle } from '../ui'

export default function PrivacyPolicy() {
  const { t, lang } = useLanguage()
  const navigate = useNavigate()

  const ar = lang === 'ar'
  const L = (key, en, fallback) => {
    const v = t(key)
    return v && v !== key ? v : (ar ? fallback : en)
  }

  const sections = [
    {
      key: 'informationWeCollect',
      title: L('informationWeCollect', 'Information We Collect', 'المعلومات اللي بنجمعها'),
      body: L('infoCollectionText', 'We collect information when you use our app, such as products added to your cart and order details. We do not collect any sensitive personal information.', 'بنجمع معلومات لما تستخدم التطبيق، زي المنتجات اللي بتضاف للعربة وتفاصيل الطلب. مش بنجمع أي معلومات شخصية حساسة.')
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
      body: L('contactPrivacyText', 'For any questions about this Privacy Policy, please email us at: louablefactory@gmail.com', 'لو عندك أي أسئلة عن سياسة الخصوصية، ابعتلنا على: louablefactory@gmail.com')
    }
  ]

  return (
    <>
      <PageTitle
        title={L('privacyPolicy', 'Privacy Policy', 'سياسة الخصوصية')}
        subtitle={<>{L('lastUpdated', 'Last Updated', 'آخر تحديث')}: February 1, 2026</>}
        actions={
          <Button variant="outline" onClick={() => navigate('/home')}>
            {L('backToHome', 'Back to home', 'رجوع للرئيسية')}
          </Button>
        }
      />

      <div className="pa-block">
        <div className="pa-container" style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {sections.map((section) => (
            <section key={section.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h2 style={{ fontSize: 20 }}>{section.title}</h2>
              <p className="pa-subtitle" style={{ margin: 0, lineHeight: 1.8 }}>{section.body}</p>
            </section>
          ))}
        </div>
      </div>

      <StoreFooter />
    </>
  )
}
