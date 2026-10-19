export const categoryIds = [
  'sport',
  'kultur',
  'kirke',
  'faellesskab',
  'erhverv',
  'handel',
  'boern-unge',
] as const;

export type CategoryId = (typeof categoryIds)[number];
export type ContentType = 'arrangement' | 'nyhed' | 'job' | 'tilbud';
export type ContentStatus = 'kladde' | 'offentliggjort' | 'arkiveret';

export interface Category {
  id: CategoryId;
  name: string;
  description: string;
  icon: string;
  color: string;
  order: number;
}

export interface Actor {
  id: string;
  name: string;
  categoryIds: CategoryId[];
  shortDescription: string;
  description: string;
  location: string;
  website?: string;
  facebook?: string;
  email?: string;
  phone?: string;
  initials: string;
}

export interface ContentItem {
  id: string;
  title: string;
  type: ContentType;
  categoryId: CategoryId;
  actorId: string;
  startAt?: string;
  endAt?: string;
  location: string;
  summary: string;
  description: string;
  linkLabel?: string;
  link?: string;
  contact?: string;
  image?: string;
  status: ContentStatus;
  publishedAt: string;
  expiresAt: string;
  featured?: boolean;
  pinned?: boolean;
}
