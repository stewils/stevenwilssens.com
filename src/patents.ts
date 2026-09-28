// Every record verified on Justia Patents (inventor: Steven Wilssens / Steven Marcel Elza Wilssens).
// Records with the same title (continuations, divisionals) are grouped under one invention.
export type PatentRecord = { number: string; date: string; filed: string }
export type Invention = { title: string; summary: string; records: PatentRecord[] }

export const justiaUrl = (number: string) => `https://patents.justia.com/patent/${number}`

// 10123150 -> US 10,123,150; 20180315437 -> US 2018/0315437
export const formatPatentNumber = (number: string) => number.length === 11 ? `US ${number.slice(0, 4)}/${number.slice(4)}` : `US ${Number(number).toLocaleString('en-US')}`

// Newest first by original grant date.
export const grantedPatents: Invention[] = [
  { title: 'Using propensity score matching to determine metric of interest for unsampled computing devices', summary: 'Estimates the user experience on devices that send no detailed telemetry by matching each one to the most similar device that does.', records: [{ number: '12436860', date: 'Oct 7, 2025', filed: 'Dec 27, 2021' }] },
  { title: 'Spatializing audio data based on analysis of incoming audio data', summary: 'Decides which incoming sounds, such as game effects, chat, or music, should be spatialized and which should play as they are.', records: [{ number: '11595774', date: 'Feb 28, 2023', filed: 'May 12, 2017' }] },
  { title: 'Server-side audio rendering licensing', summary: 'Checks a user’s license for premium audio rendering software, so cloud-streamed apps can render their audio with it on the server.', records: [{ number: '11366879', date: 'Jun 21, 2022', filed: 'Jul 8, 2019' }, { number: '12008085', date: 'Jun 11, 2024', filed: 'May 18, 2022' }] },
  { title: 'Server-side rendered audio using client audio parameters', summary: 'Tunes the audio of cloud-streamed apps on the server to match the player’s own device and audio settings.', records: [{ number: '11196787', date: 'Dec 7, 2021', filed: 'Jul 8, 2019' }] },
  { title: 'Enhanced adaptive audio rendering techniques', summary: 'Switches spatial audio technology automatically as the setup changes, such as moving from Dolby Atmos to HRTF when headphones are plugged in.', records: [{ number: '10679637', date: 'Jun 9, 2020', filed: 'Jan 16, 2019' }, { number: '10714111', date: 'Jul 14, 2020', filed: 'Jan 16, 2019' }] },
  { title: 'Frame coding for spatial audio data', summary: 'Carries spatial audio and its position metadata together in the same codec frames, with no separate metadata channel.', records: [{ number: '10535355', date: 'Jan 14, 2020', filed: 'May 31, 2017' }, { number: '11250863', date: 'Feb 15, 2022', filed: 'Dec 17, 2019' }] },
  { title: 'Personalization of spatial audio for streaming platforms', summary: 'Sends game spectators a shared audio mix that each viewer’s device then personalizes for their own ears.', records: [{ number: '10469975', date: 'Nov 5, 2019', filed: 'May 15, 2017' }] },
  { title: 'Shared three-dimensional audio bed', summary: 'Lets several apps share one 3D layout of virtual speakers, rendered with whichever spatial audio technology is active.', records: [{ number: '10419866', date: 'Sep 17, 2019', filed: 'Jun 13, 2017' }] },
  { title: 'Adaptive audio rendering', summary: 'Picks the best spatial audio technology for the connected speakers or headphones and the listener’s preferences, across every app.', records: [{ number: '10325610', date: 'Jun 18, 2019', filed: 'Jun 30, 2016' }] },
  { title: 'Multiple listener cloud render with enhanced instant replay', summary: 'Automatically creates replay clips of key moments in VR sessions, with cloud-rendered spatial audio that matches each camera angle.', records: [{ number: '10278001', date: 'Apr 30, 2019', filed: 'May 12, 2017' }] },
  { title: 'Application programming interface for adaptive audio rendering', summary: 'Gives apps an interface to share a limited budget of spatial sound objects, rendered for whatever output device is connected.', records: [{ number: '10229695', date: 'Mar 12, 2019', filed: 'Mar 15, 2017' }] },
  { title: 'Remote personalization of audio', summary: 'Renders personalized 3D audio in the cloud and streams it to devices that can’t do the processing themselves.', records: [{ number: '10149089', date: 'Dec 4, 2018', filed: 'May 31, 2017' }] },
  { title: 'Game streaming with spatial audio', summary: 'Streams game audio as a speaker-independent sound field, so any remote device can render it spatially.', records: [{ number: '10123150', date: 'Nov 6, 2018', filed: 'Jan 31, 2017' }, { number: '10667074', date: 'May 26, 2020', filed: 'Oct 30, 2018' }] },
  { title: 'Spatial audio resource management utilizing minimum resource working sets', summary: 'Shares limited spatial audio resources fairly between apps by having each declare the minimum it needs to work.', records: [{ number: '10056086', date: 'Aug 21, 2018', filed: 'Jun 6, 2017' }] },
  { title: 'Directing a playback device to play a media item selected by a controller from a media server', summary: 'Lets a phone hand a TV or speaker a link to cloud media, which then streams it directly while the phone sleeps.', records: [{ number: '9313255', date: 'Apr 12, 2016', filed: 'Jun 14, 2013' }] },
]

// Published applications without a grant, newest first by publication date.
export const patentApplications: Invention[] = [
  { title: 'Inferring a quality of a user experience for an unsampled computing device', summary: 'Infers how well an operating system performs on devices without detailed telemetry from the most similar devices that have it.', records: [{ number: '20260010454', date: 'Jan 8, 2026', filed: 'Sep 16, 2025' }] },
  { title: 'Progressive streaming of spatial audio', summary: 'Chooses which spatial audio encoder to stream with based on bandwidth and the listener’s device, switching as conditions change.', records: [{ number: '20180315437', date: 'Nov 1, 2018', filed: 'Apr 28, 2017' }] },
  { title: 'Spectator audio and video repositioning', summary: 'Lets VR spectators look around freely from a player’s position, with spatial audio that follows where they look.', records: [{ number: '20180220252', date: 'Aug 2, 2018', filed: 'Jun 7, 2017' }] },
  { title: 'Media production to operating system supported display', summary: 'Shows media cast to a PC with operating system controls, so it behaves like any other app window.', records: [{ number: '20180004476', date: 'Jan 4, 2018', filed: 'Jun 30, 2016' }] },
  { title: 'Content projection over device lock screen', summary: 'Lets a locked device show content projected from another device, and control it, without being unlocked.', records: [{ number: '20160364574', date: 'Dec 15, 2016', filed: 'Jun 11, 2015' }] },
  { title: 'Application level audio connection and streaming', summary: 'Lets an app send its own audio to a chosen device, such as a Bluetooth speaker, while system sounds play elsewhere.', records: [{ number: '20160127441', date: 'May 5, 2016', filed: 'Oct 30, 2014' }] },
  { title: 'Discovery and control of remote media sessions', summary: 'Finds media playing on other devices, like a TV or game console, and controls it with your phone’s own interface.', records: [{ number: '20160072853', date: 'Mar 10, 2016', filed: 'Sep 4, 2014' }] },
]
