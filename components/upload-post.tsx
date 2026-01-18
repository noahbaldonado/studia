"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

interface UploadPostProps {
  courseId: string;
  onUploadSuccess?: () => void;
}

export function UploadPost({ courseId, onUploadSuccess }: UploadPostProps) {
  const [postType, setPostType] = useState<"quiz" | "flashcard" | "sticky_note">("quiz");
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'error' } | null>(null);
  
  // Quiz state
  const [quizTitle, setQuizTitle] = useState("");
  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizOptions, setQuizOptions] = useState(["", "", "", ""]);
  const [correctAnswer, setCorrectAnswer] = useState(0);
  
  // Flashcard state
  const [flashcardQuestion, setFlashcardQuestion] = useState("");
  const [flashcardAnswer, setFlashcardAnswer] = useState("");
  
  // Sticky note state
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  const handleUpload = async () => {
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    try {
      let postData: any;

      if (postType === "quiz") {
        if (!quizTitle || !quizQuestion || quizOptions.some(opt => !opt.trim())) {
          setNotification({ message: "Please fill in all quiz fields", type: "error" });
          setUploading(false);
          setTimeout(() => setNotification(null), 3000);
          return;
        }
        postData = {
          type: "quiz",
          title: quizTitle,
          content: {
            question: quizQuestion,
            options: quizOptions.map(opt => opt.trim()),
            correct_answer: correctAnswer,
          },
        };
      } else if (postType === "flashcard") {
        if (!flashcardQuestion || !flashcardAnswer) {
          setNotification({ message: "Please fill in both question and answer", type: "error" });
          setUploading(false);
          setTimeout(() => setNotification(null), 3000);
          return;
        }
        postData = {
          type: "flashcard",
          content: {
            question: flashcardQuestion,
            answer: flashcardAnswer,
          },
        };
      } else if (postType === "sticky_note") {
        if (!noteTitle || !noteContent) {
          setNotification({ message: "Please fill in both title and content", type: "error" });
          setUploading(false);
          setTimeout(() => setNotification(null), 3000);
          return;
        }
        postData = {
          type: "sticky_note",
          title: noteTitle,
          content: noteContent,
        };
      }

      const response = await fetch("/api/courses/upload-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courseId,
          postData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload post");
      }

      // Reset form
      setQuizTitle("");
      setQuizQuestion("");
      setQuizOptions(["", "", "", ""]);
      setCorrectAnswer(0);
      setFlashcardQuestion("");
      setFlashcardAnswer("");
      setNoteTitle("");
      setNoteContent("");

      setUploadSuccess(true);
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error: any) {
      console.error("Error uploading post:", error);
      setUploadError(error.message || "Failed to upload post. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // Auto-hide success message after 5 seconds
  useEffect(() => {
    if (uploadSuccess) {
      const timer = setTimeout(() => {
        setUploadSuccess(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [uploadSuccess]);

  const getTitle = () => {
    switch (postType) {
      case "quiz":
        return "Upload Quiz";
      case "flashcard":
        return "Upload Flashcard";
      case "sticky_note":
        return "Upload Sticky Note";
      default:
        return "Upload Post";
    }
  };

  const getButtonText = () => {
    switch (postType) {
      case "quiz":
        return "Upload Quiz";
      case "flashcard":
        return "Upload Flashcard";
      case "sticky_note":
        return "Upload Sticky Note";
      default:
        return "Upload Post";
    }
  };

  return (
    <div className="space-y-4">
      {/* Dynamic Title */}
      <h1 className="text-2xl font-bold text-blue-900 mb-6">{getTitle()}</h1>

      {/* Type selector */}
      <div className="flex gap-2 border-b border-blue-200 pb-2">
        <button
          onClick={() => setPostType("quiz")}
          className={`flex-1 text-center px-4 py-2 rounded-lg transition-colors ${
            postType === "quiz"
              ? "bg-blue-100 text-blue-700 font-semibold"
              : "bg-blue-50 text-blue-600 hover:bg-blue-100"
          }`}
        >
          Quiz
        </button>
        <button
          onClick={() => setPostType("flashcard")}
          className={`flex-1 text-center px-4 py-2 rounded-lg transition-colors ${
            postType === "flashcard"
              ? "bg-blue-100 text-blue-700 font-semibold"
              : "bg-blue-50 text-blue-600 hover:bg-blue-100"
          }`}
        >
          Flashcard
        </button>
        <button
          onClick={() => setPostType("sticky_note")}
          className={`flex-1 text-center px-4 py-2 rounded-lg transition-colors ${
            postType === "sticky_note"
              ? "bg-blue-100 text-blue-700 font-semibold"
              : "bg-blue-50 text-blue-600 hover:bg-blue-100"
          }`}
        >
          Sticky Note
        </button>
      </div>

      {/* Form based on type */}
      {postType === "quiz" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-blue-900">Title</label>
            <input
              type="text"
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-blue-900"
              placeholder="Enter quiz title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-blue-900">Question</label>
            <textarea
              value={quizQuestion}
              onChange={(e) => setQuizQuestion(e.target.value)}
              className="w-full px-3 py-2.5 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-blue-900"
              rows={4}
              placeholder="Enter question"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-blue-900">Options</label>
            <div className="space-y-2">
              {quizOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    checked={correctAnswer === index}
                    onChange={() => setCorrectAnswer(index)}
                    className="h-4 w-4 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                  />
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...quizOptions];
                      newOptions[index] = e.target.value;
                      setQuizOptions(newOptions);
                    }}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-blue-900 placeholder:text-blue-400 ${
                      correctAnswer === index
                        ? "bg-green-50 border-2 border-green-300"
                        : "bg-white border border-blue-300"
                    }`}
                    placeholder={`Option ${index + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {postType === "flashcard" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-blue-900">Question</label>
            <textarea
              value={flashcardQuestion}
              onChange={(e) => setFlashcardQuestion(e.target.value)}
              className="w-full px-3 py-2.5 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-blue-900"
              rows={4}
              placeholder="Enter question"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-blue-900">Answer</label>
            <textarea
              value={flashcardAnswer}
              onChange={(e) => setFlashcardAnswer(e.target.value)}
              className="w-full px-3 py-2.5 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-blue-900"
              rows={4}
              placeholder="Enter answer"
            />
          </div>
        </div>
      )}

      {postType === "sticky_note" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-blue-900">Title</label>
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-blue-900"
              placeholder="Enter note title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-blue-900">Content</label>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="w-full px-3 py-2.5 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-blue-900"
              rows={6}
              placeholder="Enter note content"
            />
          </div>
        </div>
      )}

      <Button
        onClick={handleUpload}
        disabled={uploading}
        className="w-full h-12 text-base font-semibold"
      >
        {uploading ? "Uploading..." : getButtonText()}
      </Button>

      {uploadSuccess && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <Check className="h-4 w-4 text-green-600" />
          <p className="text-sm text-green-600">Post uploaded successfully!</p>
        </div>
      )}

      {uploadError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <X className="h-4 w-4 text-red-600" />
          <p className="text-sm text-red-600">{uploadError}</p>
        </div>
      )}

      {/* In-app notification */}
      {notification && (
        <div className="mt-4 px-4 py-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-300">
          {notification.message}
        </div>
      )}
    </div>
  );
}
