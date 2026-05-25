import { Loader2Icon } from "lucide-react";

const Loading = () => {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
};

export default Loading;
