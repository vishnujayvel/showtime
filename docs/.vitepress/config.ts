import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Showtime',
  description: 'An ADHD-friendly day planner built on the SNL Day Framework',
  base: '/showtime/',

  ignoreDeadLinks: true,

  head: [
    ['link', { rel: 'icon', href: '/showtime/favicon.ico' }],
    ['meta', { property: 'og:title', content: 'Showtime — ADHD Day Planner' }],
    ['meta', { property: 'og:description', content: 'Your day is a Show. Tasks are Acts. Presence moments are Beats. Rest costs zero.' }],
    ['meta', { property: 'og:image', content: '/showtime/og-image.png' }],
  ],

  themeConfig: {
    logo: '/favicon.ico',

    nav: [
      { text: 'Getting Started', link: '/getting-started/' },
      { text: 'Guide', link: '/guide/writers-room' },
      { text: 'Framework', link: '/framework/' },
      { text: 'Concepts', link: '/concepts/show-phases' },
      { text: 'App Tour', link: '/app-tour/' },
      { text: 'Contributing', link: '/contributing/' },
    ],

    sidebar: {
      '/getting-started/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Install & First Show', link: '/getting-started/' },
            { text: 'Energy Levels', link: '/getting-started/energy-levels' },
            { text: 'Keyboard Shortcuts', link: '/getting-started/keyboard-shortcuts' },
          ],
        },
      ],
      '/guide/': [
        {
          text: 'User Guide',
          items: [
            { text: 'The Writer\'s Room', link: '/guide/writers-room' },
            { text: 'The Live Show', link: '/guide/live-show' },
            { text: 'Settings', link: '/guide/settings' },
          ],
        },
      ],
      '/framework/': [
        {
          text: 'The Showtime Framework',
          items: [
            { text: 'What Is Showtime?', link: '/framework/' },
            { text: 'Research Foundations', link: '/framework/science' },
            { text: 'The SNL Metaphor', link: '/framework/snl-metaphor' },
            { text: 'ADHD Design Decisions', link: '/framework/adhd-design' },
            { text: 'The No-Guilt Philosophy', link: '/framework/no-guilt' },
          ],
        },
      ],
      '/concepts/': [
        {
          text: 'Concepts',
          items: [
            { text: 'Show Phases', link: '/concepts/show-phases' },
            { text: 'Acts & Beats', link: '/concepts/acts-and-beats' },
            { text: 'Verdicts', link: '/concepts/verdicts' },
            { text: 'Director Mode', link: '/concepts/director-mode' },
            { text: 'View Tiers', link: '/concepts/view-tiers' },
          ],
        },
      ],
      '/contributing/': [
        {
          text: 'Contributing',
          items: [
            { text: 'Development Setup', link: '/contributing/' },
            { text: 'Design System', link: '/contributing/design-system' },
            { text: 'Coding Standards', link: '/contributing/coding-standards' },
            { text: 'View System', link: '/contributing/view-system' },
            { text: 'Key Components', link: '/contributing/components' },
            { text: 'Chat-First Writer\'s Room', link: '/contributing/chat-first-writers-room' },
            { text: 'E2E Testing & Cassettes', link: '/contributing/e2e-testing-cassettes' },
            { text: 'Tech Stack', link: '/contributing/tech-stack' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/vishnujayvel/showtime' },
    ],

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Your day is a Show. Rest costs zero.',
    },
  },
})
