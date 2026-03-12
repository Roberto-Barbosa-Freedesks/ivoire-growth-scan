import { Mail, Phone, Linkedin, ExternalLink } from 'lucide-react';
import type { ContactInfo } from '../../services/apifyContactExtractor';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ContactsSectionProps {
  contacts: ContactInfo | null;
  isLoading?: boolean;
  companyName: string;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBar({ width = '100%' }: { width?: string }) {
  return (
    <div
      style={{
        height: 14,
        width,
        background: 'rgba(255,255,255,0.07)',
        borderRadius: 4,
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SkeletonBar width="60%" />
      <SkeletonBar width="45%" />
      <SkeletonBar width="75%" />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: '#999999',
        margin: '0 0 10px',
        fontFamily: 'Montserrat, sans-serif',
      }}
    >
      {children}
    </p>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <p
      style={{
        fontSize: 13,
        color: '#555555',
        fontFamily: 'Arvo, serif',
        margin: 0,
        fontStyle: 'italic',
      }}
    >
      {message}
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ContactsSection({
  contacts,
  isLoading = false,
  companyName,
}: ContactsSectionProps) {
  const hasEmails = (contacts?.emails?.length ?? 0) > 0;
  const hasPhones = (contacts?.phones?.length ?? 0) > 0;
  const hasLinkedin = (contacts?.linkedinProfiles?.length ?? 0) > 0;
  const hasAnyData = hasEmails || hasPhones || hasLinkedin;

  return (
    <section
      style={{
        background: '#1e1e1e',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.10)',
        padding: '24px 28px',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 24,
        }}
      >
        <Mail
          size={18}
          color="#FFFF02"
          strokeWidth={2}
          style={{ flexShrink: 0 }}
        />
        <h3
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 700,
            color: '#FFFFFF',
            fontFamily: 'Montserrat, sans-serif',
            letterSpacing: 0.3,
          }}
        >
          Contatos para Abordagem Comercial
        </h3>
      </div>

      {/* ── Loading skeleton ────────────────────────────────────────────────── */}
      {isLoading && <LoadingSkeleton />}

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      {!isLoading && (
        <>
          {/* No contacts at all */}
          {!contacts || !hasAnyData ? (
            <EmptyRow message="Nenhum contato público encontrado." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

              {/* Emails */}
              {hasEmails && (
                <div>
                  <SectionLabel>
                    <Mail size={11} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
                    E-mails
                  </SectionLabel>
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: 0,
                      padding: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    {contacts!.emails.map(email => (
                      <li key={email}>
                        <a
                          href={`mailto:${email}`}
                          style={{
                            color: '#FFFF02',
                            textDecoration: 'none',
                            fontSize: 13,
                            fontFamily: 'Arvo, serif',
                            wordBreak: 'break-all',
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline';
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none';
                          }}
                        >
                          {email}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Phones */}
              {hasPhones && (
                <div>
                  <SectionLabel>
                    <Phone size={11} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
                    Telefones
                  </SectionLabel>
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: 0,
                      padding: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    {contacts!.phones.map(phone => (
                      <li key={phone}>
                        <a
                          href={`tel:${phone.replace(/\s/g, '')}`}
                          style={{
                            color: '#FFFFFF',
                            textDecoration: 'none',
                            fontSize: 13,
                            fontFamily: 'Arvo, serif',
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLAnchorElement).style.color = '#FFFF02';
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLAnchorElement).style.color = '#FFFFFF';
                          }}
                        >
                          {phone}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* LinkedIn profiles */}
              {hasLinkedin && (
                <div>
                  <SectionLabel>
                    <Linkedin size={11} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
                    Decisores no LinkedIn
                  </SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {contacts!.linkedinProfiles.map((profile, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 6,
                          padding: '10px 14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 12,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              margin: '0 0 3px',
                              fontSize: 14,
                              fontWeight: 700,
                              color: '#FFFFFF',
                              fontFamily: 'Montserrat, sans-serif',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {profile.name}
                          </p>
                          <p
                            style={{
                              margin: 0,
                              fontSize: 12,
                              color: '#999999',
                              fontFamily: 'Arvo, serif',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {profile.title}
                            {profile.location ? ` · ${profile.location}` : ''}
                          </p>
                        </div>
                        {profile.linkedinUrl && (
                          <a
                            href={profile.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Ver perfil no LinkedIn"
                            style={{
                              color: '#999999',
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              textDecoration: 'none',
                              fontSize: 12,
                              fontFamily: 'Montserrat, sans-serif',
                              transition: 'color 0.15s',
                            }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLAnchorElement).style.color = '#FFFF02';
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLAnchorElement).style.color = '#999999';
                            }}
                          >
                            <ExternalLink size={13} strokeWidth={2} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Footnote ───────────────────────────────────────────────────── */}
          <p
            style={{
              marginTop: 20,
              marginBottom: 0,
              fontSize: 11,
              color: '#555555',
              fontFamily: 'Arvo, serif',
              fontStyle: 'italic',
            }}
          >
            Powered by dados públicos do site{companyName ? ` de ${companyName}` : ''} e LinkedIn via Apify
          </p>
        </>
      )}
    </section>
  );
}
