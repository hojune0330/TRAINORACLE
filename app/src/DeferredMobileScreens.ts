import React from "react"

export const DeferredMobileScreens = {
  LogDetail: React.lazy(() => import("./screens/LogDetail").then(module => ({ default: module.LogDetail }))),
  JournalArchive: React.lazy(() => import("./screens/JournalArchive").then(module => ({ default: module.JournalArchive }))),
  JournalDayReader: React.lazy(() => import("./screens/JournalDayReader").then(module => ({ default: module.JournalDayReader }))),
  Trends: React.lazy(() => import("./screens/Trends").then(module => ({ default: module.Trends }))),
  Guide: React.lazy(() => import("./screens/Guide").then(module => ({ default: module.Guide }))),
  PlanBeta: React.lazy(() => import("./screens/PlanBeta").then(module => ({ default: module.PlanBeta }))),
  PlanProposalInbox: React.lazy(() => import("./screens/plan-beta/PlanProposalInbox").then(module => ({ default: module.PlanProposalInbox }))),
  AthleteRecords: React.lazy(() => import("./screens/AthleteRecords").then(module => ({ default: module.AthleteRecords }))),
  Account: React.lazy(() => import("./screens/Account").then(module => ({ default: module.Account }))),
  ImportActivities: React.lazy(() => import("./screens/ImportActivities").then(module => ({ default: module.ImportActivities }))),
  RestoreBackup: React.lazy(() => import("./screens/RestoreBackup").then(module => ({ default: module.RestoreBackup }))),
  More: React.lazy(() => import("./screens/More").then(module => ({ default: module.More }))),
}
