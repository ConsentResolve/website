/**
 * Maps FeatureIconKey strings (kept in /src/data/features.ts so the data
 * layer stays import-free) to actual Tabler React icon components.
 *
 * Why a helper? Astro frontmatter can't store JSX, and we want one icon
 * pick per feature without spreading the import list across every page.
 */
import {
  IconLock,
  IconUserCheck,
  IconRefresh,
  IconCode,
  IconEye,
  IconAddressBook,
  IconShieldCheck,
  IconBolt,
  IconBellRinging,
  IconStar,
  IconClipboardCheck,
  IconMapPin,
  IconFilter,
  IconPlugConnected,
  IconMessage,
  IconCertificate,
  IconChartHistogram,
} from "@tabler/icons-react";
import type { FeatureIconKey } from "~/data/features";

export const FEATURE_ICONS: Record<FeatureIconKey, any> = {
  IconLock,
  IconUserCheck,
  IconRefresh,
  IconCode,
  IconEye,
  IconAddressBook,
  IconShieldCheck,
  IconBolt,
  IconBellRinging,
  IconStar,
  IconClipboardCheck,
  IconMapPin,
  IconFilter,
  IconPlugConnected,
  IconMessage,
  IconCertificate,
  IconChartHistogram,
};
