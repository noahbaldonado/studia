import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { quizId, ratingChange, isUndo } = body;

    if (!quizId || ratingChange === undefined) {
      return NextResponse.json(
        { error: "quizId and ratingChange are required" },
        { status: 400 }
      );
    }

    // Verifica che ratingChange sia valido
    if (ratingChange !== 1 && ratingChange !== -1) {
      return NextResponse.json(
        { error: "ratingChange must be 1 or -1" },
        { status: 400 }
      );
    }

    // Get current likes/dislikes and user_id (quiz creator)
    const { data: currentQuiz, error: fetchError } = await supabase
      .from("quiz")
      .select("likes, dislikes, user_id")
      .eq("id", quizId)
      .single();

    if (fetchError || !currentQuiz) {
      return NextResponse.json(
        { error: "Quiz not found" },
        { status: 404 }
      );
    }

    // Check if user has already interacted with this quiz
    const { data: existingInteraction, error: interactionCheckError } = await supabase
      .from("quiz_interaction")
      .select("is_like")
      .eq("quiz_id", quizId)
      .eq("user_id", user.id)
      .single();

    // Determine if this is a new interaction, change, or removal
    const isLike = ratingChange === 1;
    let actualRatingChange = ratingChange;

    if (interactionCheckError && interactionCheckError.code !== "PGRST116") {
      // PGRST116 is "no rows returned" which is fine
      console.error("Error checking existing interaction:", interactionCheckError);
      // Continue with rating update anyway
    } else if (existingInteraction) {
      // User has already interacted
      if (isUndo) {
        // Undo - user is removing their like/dislike (toggle off)
        // Reverse the previous change
        actualRatingChange = -ratingChange; // If they liked (+1), now removing = -1
      } else if (existingInteraction.is_like === isLike) {
        // Same action - do nothing (prevent double-liking/disliking)
        return NextResponse.json({
          success: true,
          quizId,
          likes: currentQuiz.likes || 0,
          dislikes: currentQuiz.dislikes || 0,
          message: "No change - already " + (isLike ? "liked" : "disliked"),
        });
      } else {
        // Different action - user is changing from like to dislike or vice versa
        // We need to reverse the previous rating change and apply the new one
        // Example: was +1 (like), now -1 (dislike) = net change of -2
        actualRatingChange = ratingChange * 2;
      }
    }

    // Update or create quiz_interaction record
    // Like/dislike sets interaction score to 10 (capped)
    if (existingInteraction) {
      if (isUndo) {
        // Remove interaction (undo) - but keep interaction_score at current level
        // Don't delete, just remove is_like and keep the score
        const { error: updateInteractionError } = await supabase
          .from("quiz_interaction")
          .update({ is_like: null })
          .eq("quiz_id", quizId)
          .eq("user_id", user.id);

        if (updateInteractionError) {
          console.error("Error updating quiz interaction:", updateInteractionError);
          // Continue with rating update
        }
      } else if (existingInteraction.is_like !== isLike) {
        // Update interaction (change from like to dislike or vice versa)
        // Set interaction_score to 10 (max) since they're interacting
        const { error: updateInteractionError } = await supabase
          .from("quiz_interaction")
          .update({ 
            is_like: isLike,
            interaction_score: 10  // Max score for like/dislike
          })
          .eq("quiz_id", quizId)
          .eq("user_id", user.id);

        if (updateInteractionError) {
          console.error("Error updating quiz interaction:", updateInteractionError);
          // Continue with rating update
        }
      } else {
        // Same action - ensure score is at 10
        const { error: updateInteractionError } = await supabase
          .from("quiz_interaction")
          .update({ interaction_score: 10 })
          .eq("quiz_id", quizId)
          .eq("user_id", user.id);

        if (updateInteractionError) {
          console.error("Error updating quiz interaction score:", updateInteractionError);
        }
      }
      // If same action (existingInteraction.is_like === isLike), we already returned above
    } else {
      // Create new interaction with score of 10 for like/dislike
      const { error: insertInteractionError } = await supabase
        .from("quiz_interaction")
        .insert({
          quiz_id: quizId,
          user_id: user.id,
          is_like: isLike,
          interaction_score: 10,  // Max score for like/dislike
        });

      if (insertInteractionError) {
        console.error("Error creating quiz interaction:", insertInteractionError);
        // Continue with rating update
      }
    }

    // Calculate new likes/dislikes counts
    let newLikes = currentQuiz.likes || 0;
    let newDislikes = currentQuiz.dislikes || 0;

    console.log("Before calculation:", {
      currentLikes: newLikes,
      currentDislikes: newDislikes,
      existingInteraction: existingInteraction,
      existingInteractionIsLike: existingInteraction?.is_like,
      isLike,
      isUndo,
    });

    if (isUndo) {
      // Removing interaction
      if (existingInteraction?.is_like === true) {
        newLikes = Math.max(0, newLikes - 1);
      } else if (existingInteraction?.is_like === false) {
        newDislikes = Math.max(0, newDislikes - 1);
      }
    } else if (existingInteraction && existingInteraction.is_like !== null && existingInteraction.is_like !== undefined) {
      // Changing from like to dislike or vice versa (existingInteraction exists and has a like/dislike value)
      if (existingInteraction.is_like === true && isLike === false) {
        // Was like, now dislike
        newLikes = Math.max(0, newLikes - 1);
        newDislikes = newDislikes + 1;
      } else if (existingInteraction.is_like === false && isLike === true) {
        // Was dislike, now like
        newDislikes = Math.max(0, newDislikes - 1);
        newLikes = newLikes + 1;
      }
      // If existingInteraction.is_like === isLike, we already returned early above, so this shouldn't happen
    } else {
      // New interaction (no existingInteraction OR existingInteraction.is_like is null/undefined)
      // This includes cases where interaction exists but is_like is null (view-time only interaction)
      console.log("Entering else block - new interaction");
      console.log("Before increment - newLikes:", newLikes, "newDislikes:", newDislikes, "isLike:", isLike);
      if (isLike) {
        newLikes = newLikes + 1;
        console.log("After increment likes - newLikes:", newLikes);
      } else {
        newDislikes = newDislikes + 1;
        console.log("After increment dislikes - newDislikes:", newDislikes);
      }
    }

    console.log("After calculation:", {
      newLikes,
      newDislikes,
    });

    // Update likes/dislikes in database
    const { data, error: updateError } = await supabase
      .from("quiz")
      .update({ likes: newLikes, dislikes: newDislikes })
      .eq("id", quizId)
      .select("likes, dislikes")
      .single();

    if (updateError) {
      console.error("Error updating likes/dislikes:", updateError);
      return NextResponse.json(
        { error: "Failed to update likes/dislikes" },
        { status: 500 }
      );
    }

    console.log("Database update result:", {
      returnedLikes: data.likes,
      returnedDislikes: data.dislikes,
    });

    // Update tag scores: ±0.2 for each tag associated with this quiz
    // Use actualRatingChange to handle toggle off and change scenarios correctly
    const tagScoreChange = actualRatingChange * 0.2;
    
    // Fetch all tag IDs associated with this quiz
    const { data: quizTags, error: quizTagsError } = await supabase
      .from("quiz_tag")
      .select("tag_id")
      .eq("quiz_id", quizId);

    if (quizTagsError) {
      console.error("Error fetching quiz tags:", quizTagsError);
      // Continue even if tag fetch fails - rating update was successful
    } else if (quizTags && quizTags.length > 0) {
      const tagIds = quizTags.map((qt) => qt.tag_id);
      
      // Update tag scores using RPC function for atomic updates
      const { error: tagUpdateError } = await supabase.rpc("increment_tag_scores", {
        tag_ids: tagIds,
        score_delta: tagScoreChange,
      });

      if (tagUpdateError) {
        console.error("Error updating tag scores:", tagUpdateError);
        // Continue even if tag score update fails - rating update was successful
      }
    }

    // Update current user's streak when they solve a quiz (swipe right/like)
    // Track streak when user likes a quiz for the first time
    if (ratingChange === 1 && !existingInteraction) {
      const { data: currentUserProfile } = await supabase
        .from("profile")
        .select("metadata")
        .eq("id", user.id)
        .single();

      if (currentUserProfile) {
        const metadata = (currentUserProfile.metadata as any) || {};
        const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
        const lastQuizDate = metadata.last_quiz_date || null;
        const currentStreak = metadata.current_streak || 0;
        const longestStreak = metadata.longest_streak || 0;
        
        let newStreak = currentStreak;
        if (lastQuizDate === today) {
          // Already solved today, don't increment
          newStreak = currentStreak;
        } else if (!lastQuizDate) {
          // First quiz ever
          newStreak = 1;
        } else {
          // Check if last quiz was yesterday (consecutive day)
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split("T")[0];
          
          if (lastQuizDate === yesterdayStr) {
            // Consecutive day - increment streak
            newStreak = currentStreak + 1;
          } else {
            // Streak broken - reset to 1
            newStreak = 1;
          }
        }
        
        const updatedMetadata = {
          ...metadata,
          last_quiz_date: today,
          current_streak: newStreak,
          longest_streak: newStreak > longestStreak ? newStreak : longestStreak,
        };
        
        // Update current user's streak in metadata
        await supabase
          .from("profile")
          .update({ metadata: updatedMetadata })
          .eq("id", user.id);
      }
    }

    // Update quiz creator's profile score: ±0.1
    // Use actualRatingChange to handle toggle off and change scenarios correctly
    const userScoreChange = actualRatingChange * 0.1;
    
    if (currentQuiz.user_id) {
      // Fetch current profile rating
      const { data: profileData, error: profileFetchError } = await supabase
        .from("profile")
        .select("rating")
        .eq("id", currentQuiz.user_id)
        .single();

      if (!profileFetchError && profileData) {
        const currentUserRating = profileData.rating || 7.5;
        const newUserRating = Math.min(10, Math.max(0, currentUserRating + userScoreChange));
        
        // Update profile rating (capped at 10/10)
        const { error: userScoreUpdateError } = await supabase
          .from("profile")
          .update({ rating: newUserRating })
          .eq("id", currentQuiz.user_id);

        if (userScoreUpdateError) {
          console.error("Error updating user profile score:", userScoreUpdateError);
          // Continue even if user score update fails - rating update was successful
        }
      } else {
        console.error("Error fetching quiz creator profile:", profileFetchError);
        // Continue even if profile fetch fails
      }
    }

    console.log("Returning response:", {
      success: true,
      quizId,
      likes: data.likes,
      dislikes: data.dislikes,
    });

    return NextResponse.json({
      success: true,
      quizId,
      likes: data.likes,
      dislikes: data.dislikes,
    });
  } catch (error) {
    console.error("Error in update-rating route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
