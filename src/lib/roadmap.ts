/** The public roadmap. Edit the lists here; the page at /roadmap/ reads them. */
export interface RoadmapItem {
  text: string;
  /** A quiet link shown under the item, to the homepage's hosted section. */
  link?: { label: string };
}

export interface RoadmapColumn {
  name: 'Now' | 'Next' | 'Later';
  items: RoadmapItem[];
}

export const ROADMAP_LEDE =
  'What is being built now, what comes next, and what comes later. No dates, because the order matters more than the calendar.';

export const ROADMAP: RoadmapColumn[] = [
  {
    name: 'Now',
    items: [
      { text: 'Usability sessions with five designers' },
      { text: 'A calmer project page' },
    ],
  },
  {
    name: 'Next',
    items: [
      {
        text: 'Hosted Canon: share a project with a link, and comments from people who don’t have Canon',
        link: { label: 'Join the waitlist' },
      },
      { text: 'Keep your library in a folder you choose' },
      { text: 'Canon as a downloadable Mac app' },
    ],
  },
  {
    name: 'Later',
    items: [
      { text: 'Start a prototype’s dev server from Canon' },
      { text: 'Compare two versions side by side' },
      { text: 'Team libraries' },
    ],
  },
];

export const ISSUES_URL = 'https://github.com/jamesmadson/canon/issues/new';
