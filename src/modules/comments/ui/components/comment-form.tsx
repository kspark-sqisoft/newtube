import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { useUser, useClerk } from "@clerk/nextjs";
import {zodResolver} from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {toast} from "sonner";
import { z } from "zod";
import {commentInsertSchema} from "@/db/schema";
import {Form, FormControl, FormField, FormItem, FormMessage} from "@/components/ui/form";
import { trpc } from "@/trpc/client";

interface CommentFormProps {
    videoId: string;
    onSuccess?: () => void;
}

const CommentForm = ({ 
    videoId, 
    onSuccess }: CommentFormProps) => {
        const {user} = useUser();
        const clerk = useClerk();
        const utils = trpc.useUtils();

        const create = trpc.comments.create.useMutation({
            onSuccess: () => {
                utils.comments.getMany.invalidate();
                toast.success("Comment created");
                form.reset();
                onSuccess?.();
            },
            onError: (error) => {
                toast.error("Something went wrong");
                if(error.data?.code === "UNAUTHORIZED") {
                    clerk.openSignIn();
                }
            }
        });

        const formSchema = commentInsertSchema.omit({userId:true});
        type FormValues = z.infer<typeof formSchema>;

        const form = useForm<FormValues>({
            resolver: zodResolver(formSchema),
            defaultValues:{
                videoId,
                value:""
            }
        });

        const handleSubmit = (values: FormValues) => {
            create.mutate(values);
        };


    return (
        <Form {...form}>
            <form className="flex gap-4 group" onSubmit={form.handleSubmit(handleSubmit)}>
                <UserAvatar 
                    size="lg" 
                    imageUrl={user?.imageUrl || "/user-placeholder.svg"} 
                    name={user?.username || "User"} 
                />
                <div className="flex-1">
                    <FormField name="value" control={form.control} render={({field})=>(
                        <FormItem>
                            <FormControl>
                                <Textarea
                                    {...field}
                                    placeholder="Add a comment..."
                                    className="resize-none bg-transparent overflow-hidden min-h-0"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    
                    <div className="justify-end gap-2 mt-2 flex">
                        <Button type="submit" size="sm" disabled={create.isPending}>
                            Comment
                        </Button>
                    </div>
                </div>
            </form>
        </Form>
    );
};

export default CommentForm;