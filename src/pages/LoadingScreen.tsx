import morty from "@/assets/mortmorty3.jpg"
// export default function loading(){
//     return (
//         <div>
            
//                 <div className="loading animate-pulse transition-opacity flex justify-center items-center h-screen">
//                     <img src={mortensonLogo} alt="Loading..." />
//                 </div>
           
            
//         </div>
//     );
// };
"use client";
import { AsciiArt } from "@/components/ui/ascii-art";

export default function loading() {
  return (
    <div>
    <style>{`
    @font-face {
      font-family: 'SilkScreen';
      src: url('./assets/Fonts/SilkScreen/SecretFont-regular.ttf') format('truetype');
    }
  `}</style>
    <AsciiArt
      src={morty}
      resolution={80}
      charset="braille"
      color="#06b6d4"
      inverted
      animated={false}
      className="mx-auto aspect-video w-full max-w-lg bg-neutral-950"
    />
    <p className="text-center text-white font-['SilkScreen'] animate-pulse">Loading...</p>
    </div>
  );
}


