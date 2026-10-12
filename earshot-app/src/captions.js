// What each voice line says, shown as captions. The key is the audio file; the text is what is spoken.
// Leave a line empty ("") to show nothing for it. Run `node make-captions.mjs` after adding a case to list new files.
export const CAPTIONS = {
  // Case 1: The Retirement Party
  "audio/intro.mp3": "Helen: Oh, thank goodness you’re here. Margaret’s gift has vanished, and she arrives any minute. Somebody in this room knows something, and all you have to do is listen. Cup a hand to your ear, the way you would in a noisy room, and turn toward a conversation. Try the table on your left first.",
  "audio/left-clue.mp3": "Priya: Funny thing, earlier I saw Victor carrying a big wrapped box toward the kitchen.",
  "audio/right-clue.mp3": "Luca: And nobody goes into the walk-in pantry. It stays locked until after the speeches.",
  "audio/front-clue.mp3": "Jim: Helen told me she gave the pantry key to her brother, Victor, for safekeeping.",
  "audio/ask1.mp3": "",
  "audio/reveal1.mp3": "Helen: Well done. Victor hid Margaret’s gift in the kitchen pantry, and he has the key. It was a surprise all along. She’s going to love it.",

  // Case 2: The Golden Anniversary
  "audio/case2/intro.mp3": "Helen: Welcome back. Tonight is Arthur and Beatrice’s golden anniversary. Ten minutes before the toast, Beatrice’s locket has vanished from the coat room, and nobody wants a scene. Four little conversations are going on around you. Look toward one, cup a hand to your ear, and listen in. The truth is always in the quiet bits.",
  "audio/case2/g1-clue.mp3": "Oh, Winston’s not your thief, dear. He hasn’t left the buffet since seven. I’ve watched every sausage roll go.",
  "audio/case2/g2-clue.mp3": "Odd thing though, the pianist keeps lifting his piano lid between songs. Nothing to do with the music, and he drops it the moment anyone looks over.",
  "audio/case2/g3-clue.mp3": "Between us, Arthur’s been whispering with the pianist all week. A surprise for Beatrice, he says. Wouldn’t tell me a word more.",
  "audio/case2/g4-clue.mp3": "Kit’s been on the terrace taking photos of the cake for hours. I’ve got the timestamps right here, seven-ten to eight. He never went near the coat room.",
  "audio/case2/ask.mp3": "",
  "audio/case2/reveal.mp3": "Helen: Well listened. Winston was at the buffet, Kit was on the terrace, and Felix was only keeping a promise. Arthur asked him to hide the locket inside the piano, and keep it safe until the toast. Fifty years, and still full of surprises.",

  // Case 3: The Lumen Awards (the clues in the chatter show up as notebook notes)
  "audio/case3/intro.mp3": "Jules: Good evening, Lumen Awards! I’m Jules, your host, and I have a problem. Twelve minutes before the ceremony, our Golden Waveform, the trophy for Artist of the Year, has vanished from its plinth. Nobody’s panicking. Well, I am, quietly. The terrace is full of people talking, and the truth is in the details. Cup a hand to your ear, turn toward a conversation, and listen. Whatever you overhear goes in your notebook. When you think you know, look down at it and make your accusation. Good luck, detective.",
  "audio/case3/ask.mp3": "Jules: Time’s up, or you’ve heard enough. Three questions, detective. Point at your answers and hold.",
  "audio/case3/reveal.mp3": "Jules: Brilliant! Tess, our stage manager, spotted a misspelled nameplate and took the trophy to the pool house so the engraver could fix it before anyone noticed. She kept it quiet to protect the night. She’ll be back with a perfect Golden Waveform in time. Ladies and gentlemen, the Lumen Awards!",
};