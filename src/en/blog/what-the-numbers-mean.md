---
key: post-numbers
order: 3
date: 2026-10-01
permalink: /en/blog/what-the-numbers-mean/
title: "What exactly was measured in the demo minute — LevelCast"
heading: "What exactly was measured in the demo minute"
description: "Four numbers from one minute of a sample show: the speaker gap and the overall level, before and after. What each measures, and why the second pair matters."
---
There are four numbers on this site, and they all come from the same minute. It's a minute of "Two Microphones", a sample show made for LevelCast: Ido hosts from the studio, and Maya joins remotely and sounds quieter than him. The minute went through the app's levelling chain at the Strong setting. The same numbers appear on the home page, on the demo page and in the posts here. It's worth knowing what each one measures, because without an explanation they're easy to read the wrong way round.

## The gap between speakers

The gap is the difference between the quiet parts of the minute and the loud parts. In the original version it's <span dir="ltr">{{ site.demo.gapBefore }} dB</span>, and after levelling <span dir="ltr">{{ site.demo.gapAfter }} dB</span>. Both times it's the same minute, with the same speakers and the same words. The only thing that changed is the distance between the quiet voice and the loud one.

Decibels are a logarithmic scale: each step describes a ratio between two levels. So you compare the two gaps directly rather than subtracting one from the other like prices. In this minute, the first gap is the kind that sends your hand to the knob, and the second isn't.

## The overall level

Here a different unit comes in, dBFS, which measures level relative to the maximum a digital file can hold. Zero is a ceiling you can't go past, so all the values below it are negative. The closer the number is to zero, the louder the sound.

In the original version the overall level of the minute is <span dir="ltr">{{ site.demo.overallBefore }} dBFS</span>, and after levelling <span dir="ltr">{{ site.demo.overallAfter }} dBFS</span>. So after levelling, the minute is louder.

## Why this number matters

There's a too-easy way to close a gap between two voices: turn the loud one down until it matches the quiet one. The gap number looks good, and the whole episode goes quiet. In the car, over the road noise, you have to turn it up, and your hand goes back to the knob from the other direction.

If you only look at the gap, you can't tell the two approaches apart, because both leave a small gap. That's why the overall level sits next to it. It shows which direction the gap was closed from. The quiet voice came up, the loud one was held back, and the episode as a whole stayed at a level you can hear over the road.

## What the numbers don't tell you

They describe one minute. In another episode, with other speakers and another recording, the starting gap will be different, and so will the result. In an episode where both speakers already talk at the same level, there isn't much to even out, and you'll barely notice the levelling. That's fine, and it's how it should work.

The minute shows what levelling does to a conversation where one speaker is quieter than the other, with no manual editing, while the episode plays. It's one measurement, and you can listen to the result yourself.

## What it looks like in the app

The app has three levelling strengths: off, normal and strong. The demo uses strong. Off plays the episode as it arrived. Normal is the lighter touch, and strong closes bigger gaps and suits a noisy car. You can switch between them with the levelling button in the player while you listen, and hear the difference without stopping the episode.

## Listen instead of reading

All of this is easier to hear than to read about. Both versions are [on the demo page]({{ collections.byKey.listen[lang] }}), with a switch that flips between them at exactly the same second, so you don't miss a word when you switch. Press play, wait for the guest to come in, and then switch.
