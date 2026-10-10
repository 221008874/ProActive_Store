import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'

export default function TermsOfService() {
  const { t, lang } = useLanguage()
  const { theme } = useTheme()
  const navigate = useNavigate()

  const colors = {
    light: {
      background: '#F8F4F0',
      text: '#2E1B1B',
      heading: '#3E2723',
      link: '#D4A017',
      border: '#E8DDD4'
    },
    dark: {
      background: '#1A1412',
      text: '#F8F4F0',
      heading: '#FCFAF8',
      link: '#D4A017',
      border: '#3E2723'
    }
  }

  const c = colors[theme]

  return (
    <div style={{
      background: c.background,
      color: c.text,
      minHeight: '100vh',
      padding: '2rem 1rem',
      fontFamily: 'Georgia, serif'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        backgroundColor: theme === 'light' ? '#FCFAF8' : '#2E1B1B',
        padding: '2rem',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        border: `1px solid ${c.border}`
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            marginBottom: '1.5rem',
            color: c.link,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '700',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateX(-8px)'
            e.target.style.opacity = '0.8'
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateX(0)'
            e.target.style.opacity = '1'
          }}
        >
          ← {t('back')}
        </button>

        <h1 style={{ 
          color: c.heading, 
          marginBottom: '1.5rem',
          fontSize: '2.5rem',
          fontWeight: '700'
        }}>
          {t('termsOfServiceTitle')}
        </h1>

        <div style={{ lineHeight: 1.8, fontSize: '1.05rem' }}>
          <p style={{ 
            color: theme === 'light' ? '#6B5E57' : '#C4B5AD',
            fontStyle: 'italic'
          }}>
            <strong>{t('lastUpdated')}:</strong> February 13, 2026
          </p>
          
          <h2 style={{ color: c.heading, marginTop: '2rem', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '700' }}>
            1. {t('acceptanceOfTerms')}
          </h2>
          <p style={{ color: c.text, marginBottom: '1rem' }}>
            By accessing and using the Louable website, you accept and agree to be bound by the terms and provision of this agreement. 
            If you do not agree to abide by the above, please do not use this service.
          </p>

          <h2 style={{ color: c.heading, marginTop: '2rem', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '700' }}>
            2. {t('paymentProcessing')}
          </h2>
          <p style={{ color: c.text, marginBottom: '1rem' }}>
            All products are priced in Egyptian Pounds (EGP). We currently accept payment through cash on delivery. 
            Your order will be prepared and shipped after payment confirmation. All transactions are secure and protected.
          </p>

          <h2 style={{ color: c.heading, marginTop: '2rem', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '700' }}>
            3. {t('productInfo')}
          </h2>
          <p style={{ color: c.text, marginBottom: '1rem' }}>
            We strive to provide accurate descriptions and pricing for all our chocolate products. 
            However, Louable does not warrant that product descriptions, pricing, or other content of any Louable web page is accurate, 
            complete, reliable, current, or error-free. If a product offered by Louable is not as described, 
            your sole remedy is to return it in unused condition.
          </p>

          <h2 style={{ color: c.heading, marginTop: '2rem', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '700' }}>
            4. {t('userResponsibilities')}
          </h2>
          <p style={{ color: c.text, marginBottom: '1rem' }}>
            As a user of this site, you are responsible for maintaining the confidentiality of your account information 
            and password and for restricting access to your computer. You agree to accept responsibility for all activities 
            that occur under your account or password.
          </p>

          <h2 style={{ color: c.heading, marginTop: '2rem', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '700' }}>
            5. {t('limitationOfLiability')}
          </h2>
          <p style={{ color: c.text, marginBottom: '1rem' }}>
            This site is provided by Louable on an "as is" and "as available" basis. 
            Louable makes no representations or warranties of any kind, express or implied, 
            as to the operation of this site or the information, content, materials, or products included on this site. 
            You expressly agree that your use of this site is at your sole risk.
          </p>

          <h2 style={{ color: c.heading, marginTop: '2rem', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '700' }}>
            6. Order Cancellation and Refunds
          </h2>
          <p style={{ color: c.text, marginBottom: '1rem' }}>
            Orders can be cancelled within 24 hours of placement. Refunds will be processed within 7-14 business days. 
            Opened or used products cannot be returned. All refunds will be credited back to the original payment method.
          </p>

          <h2 style={{ color: c.heading, marginTop: '2rem', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '700' }}>
            7. Shipping and Delivery
          </h2>
          <p style={{ color: c.text, marginBottom: '1rem' }}>
            Free shipping is available for all orders within Egypt. Delivery typically takes 3-7 business days 
            depending on your location. Once shipped, tracking information will be provided via email.
          </p>

          <h2 style={{ color: c.heading, marginTop: '2rem', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '700' }}>
            8. Intellectual Property
          </h2>
          <p style={{ color: c.text, marginBottom: '1rem' }}>
            This entire website is proprietary to Louable. All rights are reserved. 
            You may not reproduce, duplicate, copy, sell, resell or exploit any portion of this site without express written permission.
          </p>

          <h2 style={{ color: c.heading, marginTop: '2rem', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '700' }}>
            9. Modification of Terms
          </h2>
          <p style={{ color: c.text, marginBottom: '1rem' }}>
            Louable reserves the right to modify these terms of service at any time. 
            Your continued use of this site following the posting of revised terms means that you accept and agree to the changes.
          </p>

          <h2 style={{ color: c.heading, marginTop: '2rem', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '700' }}>
            10. {t('contactUs')}
          </h2>
          <p style={{ color: c.text, marginBottom: '1rem' }}>
            If you have any questions about these Terms of Service, please contact us at:
          </p>
          <div style={{
            background: theme === 'light' ? '#F8F4F0' : '#1A1412',
            padding: '1rem',
            borderRadius: '8px',
            border: `1px solid ${c.border}`,
            marginTop: '1rem'
          }}>
            <p style={{ margin: '0.5rem 0', color: c.text }}>
              📧 <strong>Email:</strong> louablefactory@gmail.com
            </p>
            <p style={{ margin: '0.5rem 0', color: c.text }}>
              📱 <strong>Phone:</strong> +20 123 456 7890
            </p>
            <p style={{ margin: '0.5rem 0', color: c.text }}>
              📍 <strong>Address:</strong> Luxor, Egypt
            </p>
          </div>

          <h2 style={{ color: c.heading, marginTop: '2rem', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '700' }}>
            11. Governing Law
          </h2>
          <p style={{ color: c.text, marginBottom: '1rem' }}>
            These terms and conditions are governed by and construed in accordance with the laws of Egypt, 
            and you irrevocably submit to the exclusive jurisdiction of the courts located in Egypt.
          </p>

          <div style={{
            marginTop: '3rem',
            padding: '1.5rem',
            background: theme === 'light' ? '#F8F4F0' : '#1A1412',
            borderRadius: '8px',
            border: `2px solid ${c.link}`,
            textAlign: 'center'
          }}>
            <p style={{ margin: 0, color: c.text, fontStyle: 'italic' }}>
              Thank you for choosing Louable - Premium Chocolate Experience
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}