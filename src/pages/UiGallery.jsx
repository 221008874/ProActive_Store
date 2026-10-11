// Dev-only gallery of every component and state in the design system.
//
// This exists so a component can be seen in isolation, in both languages and
// both themes, without walking a full checkout flow to reach it. It is gated
// behind import.meta.env.DEV: the route, its imports and its strings are
// dropped from the production bundle, so it ships nothing.
//
// Remove this file and its route entry together — the gallery is only useful
// while the design system is still moving.

import { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import {
  Accordion, AnnouncementBar, Badge, BottomSheet, Button, Checkbox, ColorDot, EmptyState,
  ErrorState, Field, Header, IconBack, IconBag, IconCheck, IconChevron, IconClose, IconFilter,
  IconHeart, IconHome, IconMenu, IconMinus, IconPhone, IconPlus, IconSearch, IconShare, IconShop,
  IconTrash, IconUser, PriceTag, QtyStepper, RadioCard, Select, Skeleton, SkeletonGrid, SizePicker,
  StatusPill, StepHeader, StepperField, StockHint, TabBar, useToast, ToastProvider
} from "../ui";

function Row({ label, children }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8, paddingBlock: 18, borderBottom: "1px solid var(--pa-line)" }}>
      <div className="pa-group-title">{label}</div>
      {children}
    </section>
  );
}

function Gallery() {
  const { lang, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const [size, setSize] = useState("M");
  const [color, setColor] = useState("red");
  const [qty, setQty] = useState(2);
  const [step, setStep] = useState(1);
  const [country, setCountry] = useState("eg");
  const [agreed, setAgreed] = useState(false);
  const [sheet, setSheet] = useState(false);

  const colors = [
    { id: "red", name: { ar: "أحمر", en: "Red" }, hex: "#C8102E" },
    { id: "black", name: { ar: "أسود", en: "Black" }, hex: "#121212" },
    { id: "sage", name: { ar: "مريميّة", en: "Sage" }, hex: "#9CAF88" },
    { id: "bone", name: { ar: "عاجي", en: "Bone" }, hex: "#F4F2EE" }
  ];
  const sizes = ["XS", "S", "M", "L", "XL"];
  const stockBySize = { XS: 0, S: 2, M: 3, L: 0, XL: 1 };

  return (
    <div style={{ paddingBottom: 96 }}>
      <div className="pa-announce">
        <span>UI gallery</span>
        <span className="pa-lang">
          <button type="button" onClick={toggleLanguage}>{lang === "ar" ? "English" : "العربية"}</button>
          <button type="button" onClick={toggleTheme}>{theme === "dark" ? "Light" : "Dark"}</button>
        </span>
      </div>

      <div className="pa-block">
        <h1>Design system</h1>
        <p className="pa-subtitle">Every component and state, {lang === "ar" ? "بالعربية" : "in English"}.</p>
      </div>

      <div className="pa-container">
        <Row label="Buttons">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <Button>Primary 48</Button>
            <Button variant="outline">Secondary</Button>
            <Button variant="danger">Danger</Button>
            <Button size="lg">Sticky 52</Button>
            <Button size="compact">Compact 44</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Row>

        <Row label="Badges · Pills · Counts">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <Badge>NEW</Badge>
            <Badge kind="sale">-25%</Badge>
            <StatusPill status="pending" />
            <StatusPill status="confirmed" />
            <StatusPill status="shipped" />
            <StatusPill status="delivered" />
            <StatusPill status="cancelled" />
            <StatusPill status="returned" />
            <StatusPill status="somethingNew" />
          </div>
        </Row>

        <Row label="Icons">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, color: "var(--pa-ink)" }}>
            {[IconMenu, IconSearch, IconBag, IconHeart, IconHome, IconShop, IconUser, IconBack,
              IconClose, IconShare, IconFilter, IconCheck, IconPlus, IconMinus, IconPhone, IconTrash,
              IconChevron].map((I, i) => <I key={i} width={22} height={22} />)}
          </div>
        </Row>

        <Row label="Form fields">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 220px" }}>
              <Field id="g-name" label="Full name" placeholder="Sara Mahmoud" />
            </div>
            <div style={{ flex: "1 1 220px" }}>
              <Field id="g-name-err" label="Full name" defaultValue="S" error="Enter your full name" />
            </div>
            <div style={{ flex: "1 1 220px" }}>
              <Select id="g-gov" label="Governorate" defaultValue="cairo">
                <option value="cairo">Cairo</option>
                <option value="giza">Giza</option>
              </Select>
            </div>
            <div style={{ flex: "1 1 220px" }}>
              <Select id="g-gov-admin" label="Governorate (admin 40px)" admin defaultValue="luxor">
                <option value="luxor">Luxor</option>
              </Select>
            </div>
            <div style={{ flex: "1 1 220px" }}>
              <Field id="g-phone" label="Mobile number" defaultValue="01012345678" className="pa-input--phone" />
            </div>
          </div>
          <Checkbox id="g-terms" label="I accept the terms of service" checked={agreed} onChange={setAgreed} />
          <Checkbox id="g-terms-plain" label="Dense admin row" plain defaultChecked />
        </Row>

        <Row label="Radio cards">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 420 }}>
            <RadioCard id="rc-eg" name="country" value="eg" checked={country === "eg"} onChange={setCountry}
              title="Egypt" description="Prices in EGP · Cash on delivery" />
            <RadioCard id="rc-other" name="country" value="other" checked={country === "other"} onChange={setCountry}
              title="Other countries" description="Not available yet" disabled />
          </div>
        </Row>

        <Row label="Colour and size">
          <div className="pa-swatches">
            {colors.map((c) => (
              <ColorDot key={c.id} color={c} selected={color === c.id} onSelect={setColor} lang={lang} />
            ))}
          </div>
          <div className="pa-subtitle">Selected colour: {color}</div>
          <div className="pa-swatches">
            {colors.map((c) => (
              <ColorDot key={c.id} color={c} selected={color === c.id} onSelect={setColor} lang={lang} small />
            ))}
          </div>
          <SizePicker sizes={sizes} value={size} stockBySize={stockBySize} onChange={setSize} />
          <SizePicker sizes={sizes} value={size} stockBySize={stockBySize} onChange={setSize} small />
          <StockHint stock={2} where="in red, size M" />
        </Row>

        <Row label="Quantity">
          <QtyStepper value={qty} onChange={setQty} max={5} />
          <StepperField value={qty} onChange={setQty} />
        </Row>

        <Row label="Prices">
          <PriceTag price={360} compareAtPrice={480} lang={lang} />
          <PriceTag price={360} lang={lang} large />
          <PriceTag price={360} compareAtPrice={480} lang={lang} large />
        </Row>

        <Row label="Accordion">
          <Accordion
            openId="desc"
            items={[
              { id: "desc", title: "Description", body: "Open by default. Body copy is muted 14/1.5." },
              { id: "mat", title: "Material and care", body: "Cotton 95%, elastane 5%. Machine wash cold." },
              { id: "ship", title: "Delivery and returns", body: "Cash on delivery to all 27 governorates." }
            ]}
          />
        </Row>

        <Row label="Toasts">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={() => toast.show("Added to bag")}>Toast</Button>
            <Button variant="outline" onClick={() => toast.show("Added to bag", { actionLabel: "View bag", onAction: () => toast.show("Navigating…") })}>
              Toast with action
            </Button>
          </div>
        </Row>

        <Row label="Sheets">
          <Button onClick={() => setSheet(true)}>Open bottom sheet</Button>
        </Row>

        <Row label="States">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 240px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="pa-subtitle">Skeleton</div>
              <Skeleton />
              <Skeleton variant="line" width="70%" />
              <Skeleton variant="line" width="45%" />
              <div style={{ marginTop: 8 }}><SkeletonGrid count={2} /></div>
            </div>
            <div style={{ flex: "1 1 240px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="pa-subtitle">Empty</div>
              <EmptyState title="No items match" body="Try removing a filter." actionLabel="Clear filters" />
            </div>
            <div style={{ flex: "1 1 240px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="pa-subtitle">Error</div>
              <ErrorState title="Could not load" body="Check your connection." retryLabel="Try again" />
            </div>
          </div>
        </Row>

        <Row label="Chrome">
          <div style={{ border: "1px solid var(--pa-line)" }}>
            <Header as={Link} bagCount={3} nav={[{ label: "New in", href: "/" }, { label: "Sale", href: "/" }]} onMenu={() => {}} onSearch={() => {}} />
          </div>
          <div style={{ border: "1px solid var(--pa-line)" }}>
            <TabBar active="bag" as={Link} />
          </div>
          <StepHeader title="Delivery" step={step} onBack={() => setStep((s) => Math.max(1, s - 1))} />
          <AnnouncementBar text="Free shipping over 800 EGP" lang={lang} onLang={toggleLanguage} />
        </Row>
      </div>

      {sheet && (
        <BottomSheet
          title="Filter and sort"
          onClose={() => setSheet(false)}
          footer={<Button block>Show 128 items</Button>}
        >
          <div className="pa-group-title">Sort</div>
          <div className="pa-chips">
            {["Newest", "Best selling", "Price low to high"].map((s) => <button key={s} type="button" className="pa-chip">{s}</button>)}
          </div>
          <div className="pa-group-title">Colour</div>
          <div className="pa-swatches">
            {colors.map((c) => (
              <ColorDot key={c.id} color={c} selected={color === c.id} onSelect={setColor} lang={lang} />
            ))}
          </div>
          <p className="pa-subtitle">Focus is trapped here; Escape or the backdrop closes.</p>
        </BottomSheet>
      )}
    </div>
  );
}

export default function UiGallery() {
  return (
    <ToastProvider>
      <Gallery />
    </ToastProvider>
  );
}
