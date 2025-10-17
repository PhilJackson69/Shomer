"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/apiFetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tag, Plus, X } from "lucide-react";
import { toast } from "sonner";

interface Tag {
  id: string;
  name: string;
  color: string;
  description?: string;
}

interface AlertTagManagerProps {
  alertId: string;
  currentTags: Tag[];
  onTagsUpdate: (tags: Tag[]) => void;
}

export function AlertTagManager({ alertId, currentTags, onTagsUpdate }: AlertTagManagerProps) {
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState("");
  const [newTag, setNewTag] = useState({
    name: "",
    color: "#6b7280",
    description: ""
  });

  useEffect(() => {
    fetchAvailableTags();
  }, []);

  const fetchAvailableTags = async () => {
    try {
      const response = await apiFetch("/api/tags");
      if (!response.ok) throw new Error("Failed to fetch tags");
      
      const data = await response.json();
      setAvailableTags(data.tags);
    } catch (error) {
      console.error("Error fetching tags:", error);
      toast.error("Failed to load tags");
    }
  };

  const handleAddTag = async () => {
    if (!selectedTagId) return;

    try {
      setLoading(true);
      const response = await apiFetch(`/api/alerts/${alertId}/tags`, { method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId: selectedTagId })
      });

      if (!response.ok) throw new Error("Failed to add tag");

      const selectedTag = availableTags.find(tag => tag.id === selectedTagId);
      if (selectedTag) {
        const updatedTags = [...currentTags, selectedTag];
        onTagsUpdate(updatedTags);
        toast.success("Tag added successfully");
      }

      setSelectedTagId("");
      setShowAddDialog(false);
    } catch (error) {
      console.error("Error adding tag:", error);
      toast.error("Failed to add tag");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      setLoading(true);
      const response = await apiFetch(`/api/alerts/${alertId}/tags?tagId=${tagId}`, { method: 'DELETE', credentials: "include"
      });

      if (!response.ok) throw new Error("Failed to remove tag");

      const updatedTags = currentTags.filter(tag => tag.id !== tagId);
      onTagsUpdate(updatedTags);
      toast.success("Tag removed successfully");
    } catch (error) {
      console.error("Error removing tag:", error);
      toast.error("Failed to remove tag");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTag.name.trim()) {
      toast.error("Tag name is required");
      return;
    }

    try {
      setLoading(true);
      const response = await apiFetch("/api/tags", { method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTag)
      });

      if (!response.ok) throw new Error("Failed to create tag");

      const data = await response.json();
      const createdTag = data.tag;
      
      // Add the new tag to available tags
      setAvailableTags(prev => [...prev, createdTag]);
      
      // Add the tag to the current alert
      const updatedTags = [...currentTags, createdTag];
      onTagsUpdate(updatedTags);
      
      toast.success("Tag created and added successfully");
      setNewTag({ name: "", color: "#6b7280", description: "" });
    } catch (error) {
      console.error("Error creating tag:", error);
      toast.error("Failed to create tag");
    } finally {
      setLoading(false);
    }
  };

  const getAvailableTagsForSelection = () => {
    const currentTagIds = currentTags.map(tag => tag.id);
    return availableTags.filter(tag => !currentTagIds.includes(tag.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-900">Tags</h4>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Tag
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Tag to Alert</DialogTitle>
              <DialogDescription>
                Select an existing tag to add to this alert, or create a new one.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {getAvailableTagsForSelection().length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="tag-select">Select Existing Tag</Label>
                  <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a tag..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableTagsForSelection().map((tag) => (
                        <SelectItem key={tag.id} value={tag.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: tag.color }}
                            />
                            {tag.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="text-center text-gray-500">or</div>

              <div className="space-y-2">
                <Label htmlFor="new-tag-name">Create New Tag</Label>
                <Input
                  id="new-tag-name"
                  placeholder="Tag name"
                  value={newTag.name}
                  onChange={(e) => setNewTag(prev => ({ ...prev, name: e.target.value }))}
                />
                <Input
                  placeholder="Description (optional)"
                  value={newTag.description}
                  onChange={(e) => setNewTag(prev => ({ ...prev, description: e.target.value }))}
                />
                <div className="flex items-center gap-2">
                  <Label htmlFor="tag-color">Color:</Label>
                  <input
                    id="tag-color"
                    type="color"
                    value={newTag.color}
                    onChange={(e) => setNewTag(prev => ({ ...prev, color: e.target.value }))}
                    className="w-12 h-8 border rounded"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowAddDialog(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              {selectedTagId && (
                <Button 
                  onClick={handleAddTag}
                  disabled={loading}
                >
                  Add Selected Tag
                </Button>
              )}
              {newTag.name.trim() && (
                <Button 
                  onClick={handleCreateTag}
                  disabled={loading}
                >
                  Create & Add Tag
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2">
        {currentTags.map((tag) => (
          <Badge 
            key={tag.id} 
            variant="secondary" 
            className="flex items-center gap-1"
            style={{ backgroundColor: tag.color + "20", borderColor: tag.color }}
          >
            <Tag className="h-3 w-3" />
            {tag.name}
            <button
              onClick={() => handleRemoveTag(tag.id)}
              disabled={loading}
              className="ml-1 hover:bg-red-100 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        
        {currentTags.length === 0 && (
          <p className="text-sm text-gray-500 italic">No tags assigned</p>
        )}
      </div>
    </div>
  );
}
