// src/pages/TermsOfService.jsx — ProActive Fashion design system refactor.
//
// Content is unchanged: the same eleven numbered clauses, the same contact
// details and the same closing line. The back handler (navigate(-1)) survives
// on a design-system outline button; the 900px card is now a full-bleed
// .pa-block band with a centred .pa-container measure, and the contact /
// closing panels are .pa-callout blocks.

import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import StoreFooter from '../components/StoreFooter'
import { Button, PageTitle } from '../ui'

export default function TermsOfService() {
  const { t, lang } = useLanguage()
  const navigate = useNavigate()

  const ar = lang === 'ar'
  const L = (key, en, fallback) => {
    const v = t(key)
    return v && v !== key ? v : (ar ? fallback : en)
  }

  const sections = [
    {
      n: 1,
      title: L('acceptanceOfTerms', 'Acceptance of Terms', 'قبول الشروط'),
      body: L(null, 'By accessing and using the ProActive Store website, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.', 'باستخدامك موقع برو أكتيف ستور، بتوافق على شروط وأحكام الاتفاقية دي. لو مش موافق على البنود دي، من فضلك متستخدمش الخدمة.')
    },
    {
      n: 2,
      title: L('paymentProcessing', 'Payment Processing', 'الدفع'),
      body: L(null, 'All products are priced in Egyptian Pounds (EGP). We currently accept payment through cash on delivery. Your order will be prepared and shipped after payment confirmation. All transactions are secure and protected.', 'كل المنتجات بسعرها بالجنيه المصري. حالياً بنقبل الدفع عند الاستلام. طلبك هيتجهز ويتبعت بعد تأكيد الدفع. كل المعاملات آمنة ومحمية.')
    },
    {
      n: 3,
      title: L('productInfo', 'Product Information', 'معلومات المنتجات'),
      body: L(null, 'We strive to provide accurate descriptions and pricing for all our products. However, ProActive Store does not warrant that product descriptions, pricing, or other content of any ProActive Store web page is accurate, complete, reliable, current, or error-free. If a product offered by ProActive Store is not as described, your sole remedy is to return it in unused condition.', 'بنسعى نقدم أوصاف وأسعار دقيقة لكل منتجاتنا. لكن برو أكتيف ستور مش بتضمن دقة أو اكتمال أو موثوقية أو خلو من الأخطاء لأي محتوى في الموقع. لو المنتج مش كما هو موصوف، الحل الوحيد هو إرجاعه في حالة عدم الاستخدام.')
    },
    {
      n: 4,
      title: L('userResponsibilities', 'User Responsibilities', 'مسؤولياتك'),
      body: L(null, 'As a user of this site, you are responsible for maintaining the confidentiality of your account information and password and for restricting access to your computer. You agree to accept responsibility for all activities that occur under your account or password.', 'كمستخدم للموقع ده، مسؤول عن الحفاظ على سرية معلومات حسابك وكلمة المرور وتقييد الوصول لجهازك. وبتتحمل مسؤولية كل الأنشطة اللي تحصل من خلال حسابك أو كلمة مرورك.')
    },
    {
      n: 5,
      title: L('limitationOfLiability', 'Limitation of Liability', 'حدود المسؤولية'),
      body: L(null, 'This site is provided by ProActive Store on an "as is" and "as available" basis. ProActive Store makes no representations or warranties of any kind, express or implied, as to the operation of this site or the information, content, materials, or products included on this site. You expressly agree that your use of this site is at your sole risk.', 'الموقع ده بيقدمه برو أكتيف ستور "كما هو" و"حسب التوفر". ومش بتقدم أي ضمانات من أي نوع، صريحة أو ضمنية، بخصوص تشغيل الموقع أو المعلومات أو المحتوى أو المنتجات. وبتوافق صراحةً إن استخدامك للموقع على مسؤوليتك الشخصية.')
    },
    {
      n: 6,
      title: L('orderCancellationRefunds', 'Order Cancellation and Refunds', 'إلغاء الطلب واسترجاع الفلوس'),
      body: L(null, 'Orders can be cancelled within 24 hours of placement. Refunds will be processed within 7-14 business days. Opened or used products cannot be returned. All refunds will be credited back to the original payment method.', 'الطلبات تقدر تتلغى خلال 24 ساعة من الطلب. الاسترجاع بيتم خلال 7-14 يوم عمل. المنتجات المفتوحة أو المستخدمة مينفعش ترجع. كل المبالغ هترجع بنفس طريقة الدفع الأصلية.')
    },
    {
      n: 7,
      title: L('shippingDelivery', 'Shipping and Delivery', 'الشحن والتوصيل'),
      body: L(null, 'Free shipping is available for all orders within Egypt. Delivery typically takes 3-7 business days depending on your location. Once shipped, tracking information will be provided via email.', 'الشحن مجاني لكل الطلبات داخل مصر. التوصيل بياخد عادة 3-7 أيام عمل حسب موقعك. وبعد الشحن، بيانات التتبع هتتبعت على البريد الإلكتروني.')
    },
    {
      n: 8,
      title: L('intellectualProperty', 'Intellectual Property', 'الملكية الفكرية'),
      body: L(null, 'This entire website is proprietary to ProActive Store. All rights are reserved. You may not reproduce, duplicate, copy, sell, resell or exploit any portion of this site without express written permission.', 'الموقع بالكامل ملكية خاصة ببرو أكتيف ستور. كل الحقوق محفوظة. ومينفعش تعيد إنتاج أو تنسخ أو تبيع أو تستغل أي جزء من الموقع بدون إذن كتابي صريح.')
    },
    {
      n: 9,
      title: L('modificationOfTerms', 'Modification of Terms', 'تعديل الشروط'),
      body: L(null, 'ProActive Store reserves the right to modify these terms of service at any time. Your continued use of this site following the posting of revised terms means that you accept and agree to the changes.', 'برو أكتيف ستور تحتفظ بالحق في تعديل شروط الخدمة في أي وقت. واستمرارك في استخدام الموقع بعد نشر الشروط المعدلة يعني موافقتك على التغييرات.')
    },
    {
      n: 10,
      title: L('contactUs', 'Contact Us', 'تواصل معانا'),
      body: L(null, 'If you have any questions about these Terms of Service, please contact us at:', 'لو عندك أي أسئلة عن شروط الخدمة، تواصل معانا على:'),
      contact: true
    },
    {
      n: 11,
      title: L('governingLaw', 'Governing Law', 'القانون الحاكم'),
      body: L(null, 'These terms and conditions are governed by and construed in accordance with the laws of Egypt, and you irrevocably submit to the exclusive jurisdiction of the courts located in Egypt.', 'الشروط والأحكام دي محكومة ومفسرة وفقاً لقوانين مصر، وبتخضع بشكل نهائي للاختصاص القضائي الحصري للمحاكم المصرية.')
    }
  ]

  return (
    <>
      <PageTitle
        title={L('termsOfServiceTitle', 'Terms of Service', 'شروط الخدمة')}
        subtitle={<>{L('lastUpdated', 'Last Updated', 'آخر تحديث')}: February 13, 2026</>}
        actions={
          <Button variant="outline" onClick={() => navigate(-1)}>
            {L('back', 'Back', 'رجوع')}
          </Button>
        }
      />

      <div className="pa-block">
        <div className="pa-container" style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {sections.map((section) => (
            <section key={section.n} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h2 style={{ fontSize: 20 }}>{section.n}. {section.title}</h2>
              <p className="pa-subtitle" style={{ margin: 0, lineHeight: 1.8 }}>{section.body}</p>
              {section.contact && (
                <div className="pa-callout" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  <span>📧 <b>{L('email', 'Email', 'البريد الإلكتروني')}:</b> <bdi>proactive.store.eg@gmail.com</bdi></span>
                  <span>📱 <b>{L('phoneNumber', 'Phone', 'الهاتف')}:</b> <bdi>+20 123 456 7890</bdi></span>
                  <span>📍 <b>{L('address', 'Address', 'العنوان')}:</b> {L(null, 'Luxor, Egypt', 'الأقصر، مصر')}</span>
                </div>
              )}
            </section>
          ))}

          <div className="pa-callout" style={{ textAlign: 'center', fontStyle: 'italic' }}>
            {L(null, 'Thank you for choosing ProActive Store - Fresh Style, Delivered', 'تجربة أني؂ة')}
          </div>
        </div>
      </div>

      <StoreFooter />
    </>
  )
}
