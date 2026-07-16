import { ClerkProvider } from '@clerk/nextjs';

export default function PlatformProvider({ children, includeIcons = false }) {
  return (
    <ClerkProvider
      taskUrls={{ 'choose-organization': '/session-tasks/choose-organization' }}
      appearance={{
        variables: {
          colorPrimary: '#e98745',
          colorBackground: '#111b19',
          colorForeground: '#f7f5ef',
          borderRadius: '0.85rem',
          fontFamily: 'var(--font-geist)',
        },
      }}
    >
      {includeIcons && (
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      )}
      {children}
    </ClerkProvider>
  );
}
