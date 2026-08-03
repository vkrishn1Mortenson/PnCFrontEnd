import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { FloatingDockDemo } from "@/components/ui/FloatingDock";

// export default function Projects() {
//   return (
//     <div className="flex flex-col items-center justify-center min-h-screen gap-8">
//       <Card className="w-[350px]">
//         <CardHeader>
//           <CardTitle>Project Name</CardTitle>
//           <CardDescription>
//             Open your project in Dashboard view
//           </CardDescription>
//         </CardHeader>

//         <CardContent>
//           <form>
//             <div className="grid w-full items-center gap-4">
//               <div className="flex flex-col space-y-1.5">
//                 <Label htmlFor="framework">Framework</Label>

//                 <Select>
//                   <SelectTrigger id="framework">
//                     <SelectValue placeholder="Select" />
//                   </SelectTrigger>

//                   <SelectContent position="popper">
//                     <SelectItem value="next">Next.js</SelectItem>
//                     <SelectItem value="sveltekit">SvelteKit</SelectItem>
//                     <SelectItem value="astro">Astro</SelectItem>
//                     <SelectItem value="nuxt">Nuxt.js</SelectItem>
//                   </SelectContent>
//                 </Select>
//               </div>
//             </div>
//           </form>
//         </CardContent>

//         <CardFooter className="flex justify-between">
//           <Button variant="outline">Cancel</Button>
//           <Button>Open</Button>
//         </CardFooter>
//       </Card>

//       <FloatingDockDemo />
//     </div>
//   );
// }

"use client";

import React from "react";
import { CardBody, CardContainer, CardItem } from "@/components/ui/3d-card";

export default function Projects() {
  return (
    <div className="min-h-screen">
    <CardContainer className="inter-var">
      <CardBody className="bg-gray-50 relative group/card  dark:hover:shadow-2xl dark:hover:shadow-emerald-500/[0.1] dark:bg-black dark:border-white/[0.2] border-black/[0.1] w-auto sm:w-[30rem] h-auto rounded-xl p-6 border  ">
        <CardItem
          translateZ="50"
          className="text-xl font-bold text-neutral-600 dark:text-white"
        >
          Example Components view / projects view TBD
        </CardItem>
        <CardItem
          as="p"
          translateZ="60"
          className="text-neutral-500 text-sm max-w-sm mt-2 dark:text-neutral-300"
        >
          Description to components or projects  
        </CardItem>
        <CardItem translateZ="100" className="w-full mt-4">
          <img
            src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2560&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
            height="1000"
            width="1000"
            className="h-60 w-full object-cover rounded-xl group-hover/card:shadow-xl"
            alt="thumbnail"
          />
        </CardItem>
        <div className="flex justify-between items-center mt-20">
          <CardItem
            translateZ={20}
            as="a"
            href="https://twitter.com/mannupaaji"
            target="__blank"
            className="px-4 py-2 rounded-xl text-xs font-normal dark:text-white"
          >
          Cancel
          </CardItem>
          <CardItem
            translateZ={20}
            as="button"
            className="px-4 py-2 rounded-xl bg-black dark:bg-white dark:text-black text-white text-xs font-bold"
          >
            Accept
          </CardItem>
        </div>
      </CardBody>
    </CardContainer>
    <FloatingDockDemo />    
    </div>
  );
}
