import React, { useState, useCallback } from 'react';
import { Search, Filter, X, FileText, AlertCircle, Loader2, ArrowUpDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { searchDocuments, type SearchResult, type SemanticSearchOptions } from '@/lib/ai/semantic-search';
import { useToast } from '@/hooks/use-toast';

interface SemanticSearchProps {
  caseId?: string;
  onDocumentClick?: (documentId: string) => void;
  className?: string;
}

export function SemanticSearch({ caseId, onDocumentClick, className }: SemanticSearchProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [searchOptions, setSearchOptions] = useState<SemanticSearchOptions>({
    topK: 10,
    minScore: 50,
    includeChunks: true,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<SearchResult | null>(null);

  const { toast } = useToast();

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      toast({
        title: 'Query required',
        description: 'Please enter a search query',
        variant: 'destructive',
      });
      return;
    }

    setIsSearching(true);
    setResults([]);
    setSelectedDocument(null);

    try {
      const options: SemanticSearchOptions = {
        ...searchOptions,
        caseId,
        includeChunks: true,
      };

      const searchResults = await searchDocuments(query.trim(), options);
      setResults(searchResults);

      if (searchResults.length === 0) {
        toast({
          title: 'No results found',
          description: 'Try adjusting your search query or filters',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Search failed:', error);
      toast({
        title: 'Search failed',
        description: 'An error occurred while searching. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  }, [query, searchOptions, caseId, toast]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  }, [handleSearch]);

  const handleDocumentClick = useCallback((document: SearchResult) => {
    setSelectedDocument(document);
    if (onDocumentClick) {
      onDocumentClick(document.documentId);
    }
  }, [onDocumentClick]);

  const clearFilters = useCallback(() => {
    setSearchOptions({
      topK: 10,
      minScore: 50,
      includeChunks: true,
    });
  }, []);

  const renderSearchResult = (result: SearchResult) => (
    <Card
      key={result.documentId}
      className="hover:border-blue-500 transition-colors cursor-pointer"
      onClick={() => handleDocumentClick(result)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold line-clamp-2">{result.documentName}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{result.caseName}</p>
          </div>
          <div className="text-right">
            <Badge variant="secondary" className="mb-2">
              {result.score}% match
            </Badge>
            {result.batesNumber && (
              <p className="text-xs text-muted-foreground font-mono">
                {result.batesNumber}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {result.chunks.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                {result.chunks.length} relevant section{result.chunks.length !== 1 ? 's' : ''}
              </span>
            </div>
            <ScrollArea className="h-[120px]">
              {result.chunks.slice(0, 3).map((chunk, index) => (
                <div key={chunk.id} className="mb-2 p-2 bg-muted rounded">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center justify-between">
                    Score: {chunk.score}%
                    {chunk.pageNumber && (
                      <span className="text-xs text-muted-foreground">
                        Page {chunk.pageNumber}
                      </span>
                    )}
                  </p>
                  <p className="text-sm line-clamp-2">{chunk.content}</p>
                </div>
              ))}
              {result.chunks.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  +{result.chunks.length - 3} more sections...
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-8">
            No specific sections match your query
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1">
          <Input
            placeholder="Search documents semantically (e.g., 'Find documents about qualified immunity' or 'Show emails regarding settlement discussions')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSearching}
            className="h-10"
          />
        </div>
        <Button onClick={handleSearch} disabled={isSearching} className="h-10">
          {isSearching ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          Search
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="h-10"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </div>

      {showFilters && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Search Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Number of Results</Label>
              <Select
                value={searchOptions.topK?.toString() || '10'}
                onValueChange={(value) =>
                  setSearchOptions(prev => ({ ...prev, topK: parseInt(value) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">Top 5</SelectItem>
                  <SelectItem value="10">Top 10</SelectItem>
                  <SelectItem value="20">Top 20</SelectItem>
                  <SelectItem value="50">Top 50</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Minimum Relevance Score (%)</Label>
              <Select
                value={searchOptions.minScore?.toString() || '50'}
                onValueChange={(value) =>
                  setSearchOptions(prev => ({ ...prev, minScore: parseInt(value) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30% and above</SelectItem>
                  <SelectItem value="50">50% and above</SelectItem>
                  <SelectItem value="70">70% and above</SelectItem>
                  <SelectItem value="90">90% and above</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Document Types</Label>
              <Select
                value={searchOptions.documentTypes?.join(',') || ''}
                onValueChange={(value) =>
                  setSearchOptions(prev => ({
                    ...prev,
                    documentTypes: value ? value.split(',') : undefined,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All document types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All document types</SelectItem>
                  <SelectItem value="pdf">PDF documents</SelectItem>
                  <SelectItem value="doc">Word documents</SelectItem>
                  <SelectItem value="docx">Word documents</SelectItem>
                  <SelectItem value="txt">Text files</SelectItem>
                  <SelectItem value="jpg">Images</SelectItem>
                  <SelectItem value="jpeg">Images</SelectItem>
                  <SelectItem value="png">Images</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isSearching && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">Searching and analyzing documents...</span>
        </div>
      )}

      {!isSearching && results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">
              {results.length} result{results.length !== 1 ? 's' : ''} found
            </h3>
            <Badge variant="outline">
              Semantic Search
            </Badge>
          </div>

          <Separator />

          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Results</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="chunks">Chunks</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {results.map(renderSearchResult)}
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              {results.map(renderSearchResult)}
            </TabsContent>

            <TabsContent value="chunks" className="space-y-4">
              {results.flatMap(result =>
                result.chunks.map(chunk => (
                  <Card key={`${result.documentId}-${chunk.id}`} className="hover:border-blue-500">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <CardTitle className="text-lg font-semibold">{result.documentName}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">{result.caseName}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className="mb-2">
                            {chunk.score}% match
                          </Badge>
                          {chunk.pageNumber && (
                            <p className="text-xs text-muted-foreground font-mono">
                              Page {chunk.pageNumber}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed">{chunk.content}</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {!isSearching && results.length === 0 && query.trim() && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No results found</h3>
            <p className="text-muted-foreground max-w-md">
              Try adjusting your search query or filters to find more relevant documents. Our semantic search understands legal concepts and context, not just keywords.
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={selectedDocument !== null} onOpenChange={() => setSelectedDocument(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.documentName}</DialogTitle>
            <DialogDescription>
              {selectedDocument?.caseName}
              {selectedDocument?.batesNumber && ` | ${selectedDocument.batesNumber}`}
            </DialogDescription>
          </DialogHeader>
          {selectedDocument && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{selectedDocument.score}% match</Badge>
                {selectedDocument.chunks.length > 0 && (
                  <Badge variant="outline">
                    {selectedDocument.chunks.length} relevant sections
                  </Badge>
                )}
              </div>

              <Separator />

              {selectedDocument.chunks.length > 0 ? (
                <ScrollArea className="h-[50vh]">
                  <div className="space-y-6">
                    {selectedDocument.chunks.map((chunk, index) => (
                      <div key={chunk.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{chunk.score}% match</Badge>
                          {chunk.pageNumber && (
                            <Badge variant="outline">Page {chunk.pageNumber}</Badge>
                          )}
                        </div>
                        <Card className="border-l-2 border-blue-500">
                          <CardContent className="pt-4">
                            <p className="text-sm leading-relaxed">{chunk.content}</p>
                            {chunk.context && (
                              <p className="text-xs text-muted-foreground mt-2">
                                {chunk.context}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                        {index < selectedDocument.chunks.length - 1 && (
                          <Separator className="my-2" />
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No specific sections match your query in this document
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
