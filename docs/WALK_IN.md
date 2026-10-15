# The walk-in footage

The Store Front opens with a walk into the store that ends facing the new releases wall, then fades to the live shelf
of your real tapes. The app plays it once a day (OK or Back skips it; "Walk in again" replays it).

It needs two files in `public/store/`:

| File | What it is |
| --- | --- |
| `walk-in.mp4` | The walk-in, 8-12 seconds, 16:9, no sound |
| `shelf.jpg` | The last frame of that video. It sits behind the live shelf, so the cut from video to shelf is seamless |

Until they exist, the Store Front uses a darkened still from Tonight's pick behind the shelf.

## The rendered walk-in

The walk-in is a 3D store built in code (three.js) and rendered offline in headless Chromium, frame by frame, at
1920x1080 and 30 fps. Free, no AI tool, no credits. 6 seconds: the street at night under the VIDEO / Cinematheque sign,
through the glass doors, down the main aisle, then it stops square-on to the new releases wall and holds for 1 second.
The tapes and wall posters are real covers from TMDB: the store's sample titles (on the new releases wall) plus
well-known films from 1975-1999. The source is in `scripts/walkin/`.

**Not in git.** The video shows TMDB posters, so like all artwork it is never committed: `public/store/` is git-ignored.
Copy `walk-in.mp4` and `shelf.jpg` into the project's `public/store/` folder on the machine running the app (your PC for now, the NAS later) (the Store Front picks them up at the next build),
or render them yourself:

```bash
cd scripts/walkin
npm i && npm run fonts
TMDB_API_KEY=… npm run covers            # 140 posters into covers/ (git-ignored)
node render.mjs stills 0,3,6,12          # quick check: out/still_<t>.png
node render.mjs frames 30                # all 180 frames into out/frames/ (resumes where it stopped if run again); about half an hour on 4 cores
ffmpeg -framerate 30 -i out/frames/f_%05d.png -c:v libx264 -crf 23 -preset slow -tune grain -pix_fmt yuv420p -movflags +faststart ../../public/store/walk-in.mp4
cp out/frames/f_00179.png /tmp/last.png && ffmpeg -i /tmp/last.png -q:v 2 ../../public/store/shelf.jpg
```

Without `covers/` the scene falls back to invented covers (no artwork, so that version could be committed).

`CHROME_PATH` points `render.mjs` at a Chromium binary if it isn't at the Playwright default.

## Prompt for the video tool (Veo, Kling, Runway, Sora...)

Camera move: slow first-person steadicam walk / dolly in, eye level, one continuous shot.

> A slow, steady first-person walk into a small 1980s neighbourhood video rental store at night, one continuous shot at eye level, cinematic, photorealistic, 35mm film look. The shot starts just outside the glass front door at night, pushes through the door and moves down the main aisle between tall white shelving units lined with VHS boxes facing out. The store is lit by cool lavender and periwinkle fluorescent ceiling panels; each shelf has a pink neon strip glowing underneath; the walls are dark navy tile; a cyan neon sign glows on the back wall. Patterned arcade carpet with magenta dots and yellow squiggles. The camera slows down and stops square-on to the back wall shelf, two long white shelves filling the frame, then holds still for two seconds. No people. No readable text, no logos, no brand names.

If the tool takes a separate negative prompt: `people, hands, readable text, logos, watermarks, shaky camera, fisheye, cartoon, illustration`.

Generate 2-3 takes and keep the one that ends most squarely on the shelf.

## Getting the files ready

With ffmpeg (free) in the folder where the video was saved:

```bash
# H.264 for the TV box, 1080p, no audio, starts playing before it's fully loaded
ffmpeg -i take.mp4 -an -vf scale=1920:-2 -c:v libx264 -crf 20 -preset slow -movflags +faststart walk-in.mp4
# the last frame, for behind the shelf
ffmpeg -sseof -0.1 -i walk-in.mp4 -frames:v 1 -q:v 2 shelf.jpg
```

Put both in `public/store/` and reload the Store Front.
