# The walk-in footage

The Store Front opens with a walk into the store that ends facing the new releases wall, then fades to the live shelf
of your real tapes. The app plays it once a day (OK or Back skips it; "Walk in again" replays it).

It needs two files in `public/store/`:

| File | What it is |
| --- | --- |
| `walk-in.mp4` | The walk-in, 8-12 seconds, 16:9, no sound |
| `shelf.jpg` | The last frame of that video. It sits behind the live shelf, so the cut from video to shelf is seamless |

Until they exist, the Store Front uses a darkened still from Tonight's pick behind the shelf.

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
