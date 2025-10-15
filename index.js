#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ToolSchema, } from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import os from 'os';
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { createTwoFilesPatch } from 'diff';
import { minimatch } from 'minimatch';

// Command line argument parsing
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error("Usage: mcp-server-filesystem <allowed-directory> [additional-directories...]");
    process.exit(1);
}

// Normalize all paths consistently
function normalizePath(p) {
    return path.normalize(p);
}
function expandHome(filepath) {
    if (filepath.startsWith('~/') || filepath === '~') {
        return path.join(os.homedir(), filepath.slice(1));
    }
    return filepath;
}

// Store allowed directories in normalized form
const allowedDirectories = args.map(dir => normalizePath(path.resolve(expandHome(dir))));

// Validate that all directories exist and are accessible
await Promise.all(args.map(async (dir) => {
    try {
        const stats = await fs.stat(dir);
        if (!stats.isDirectory()) {
            console.error(`Error: ${dir} is not a directory`);
            process.exit(1);
        }
    }
    catch (error) {
        console.error(`Error accessing directory ${dir}:`, error);
        process.exit(1);
    }
}));
// Security utilities
async function validatePath(requestedPath) {
    const expandedPath = expandHome(requestedPath);
    const absolute = path.isAbsolute(expandedPath)
        ? path.resolve(expandedPath)
        : path.resolve(process.cwd(), expandedPath);
    const normalizedRequested = normalizePath(absolute);
    // Check if path is within allowed directories
    const isAllowed = allowedDirectories.some(dir => normalizedRequested.startsWith(dir));
    if (!isAllowed) {
        throw new Error(`Access denied - path outside allowed directories: ${absolute} not in ${allowedDirectories.join(', ')}`);
    }
    // Handle symlinks by checking their real path
    try {
        const realPath = await fs.realpath(absolute);
        const normalizedReal = normalizePath(realPath);
        const isRealPathAllowed = allowedDirectories.some(dir => normalizedReal.startsWith(dir));
        if (!isRealPathAllowed) {
            throw new Error("Access denied - symlink target outside allowed directories");
        }
        return realPath;
    }
    catch (error) {
        // For new files that don't exist yet, verify parent directory
        const parentDir = path.dirname(absolute);
        try {
            const realParentPath = await fs.realpath(parentDir);
            const normalizedParent = normalizePath(realParentPath);
            const isParentAllowed = allowedDirectories.some(dir => normalizedParent.startsWith(dir));
            if (!isParentAllowed) {
                throw new Error("Access denied - parent directory outside allowed directories");
            }
            return absolute;
        }
        catch {
            throw new Error(`Parent directory does not exist: ${parentDir}`);
        }
    }
}

// #####################################################

// Schema definitions

// Added by Krisu 15.10.2025
const GetPythonVersionSchema = z.object({});

// Added by Krisu 15.10.2025
const GetPipVersionSchema = z.object({});

// Added by Krisu 15.10.2025
const GetNodeVersionSchema = z.object({});

// Added by Krisu 15.10.2025
const GetGitVersionSchema = z.object({});

// Added by Krisu 15.10.2025
const GetFreebasicVersionSchema = z.object({});

// Added by Krisu 15.10.2025
const GetNpmVersionSchema = z.object({});

// Added by Krisu 15.10.2025
const GetPipPackagesSchema = z.object({});

// Added by Krisu 15.10.2025
const GetNpmGlobalPackagesSchema = z.object({});

// Added by Krisu 15.10.2025
const GetNpmProjectPackagesSchema = z.object({});

// Added by Krisu 15.10.2025
const GetDotnetInfoSchema = z.object({});

// Added by Krisu 15.10.2025
const GetSystemInfoSchema = z.object({});

// Added by Krisu 15.10.2025
const GetNvidiaSmiSchema = z.object({});

// Added by Krisu 15.10.2025
const GetNetworkInfoSchema = z.object({});

// Added by Krisu 14.10.2025
const GetDriveInfoSchema = z.object({
});

// Added by Krisu 14.10.2025
const DeleteFileArgsSchema = z.object({
    path: z.string(),
});

// Added by Krisu 14.10.2025
const CopyFileArgsSchema = z.object({
    source: z.string(),
    destination: z.string(),
});

// Added by Krisu 14.10.2025
const GetLocalTimeSchema = z.object({
});

// Added by Krisu 15.10.2025
const GetSqlite3VersionSchema = z.object({
});

const ReadFileArgsSchema = z.object({
    path: z.string(),
});
const ReadMultipleFilesArgsSchema = z.object({
    paths: z.array(z.string()),
});
const WriteFileArgsSchema = z.object({
    path: z.string(),
    content: z.string(),
});
const EditOperation = z.object({
    oldText: z.string().describe('Text to search for - must match exactly'),
    newText: z.string().describe('Text to replace with')
});
const EditFileArgsSchema = z.object({
    path: z.string(),
    edits: z.array(EditOperation),
    dryRun: z.boolean().default(false).describe('Preview changes using git-style diff format')
});
const CreateDirectoryArgsSchema = z.object({
    path: z.string(),
});
const ListDirectoryArgsSchema = z.object({
    path: z.string(),
});
const DirectoryTreeArgsSchema = z.object({
    path: z.string(),
});
const MoveFileArgsSchema = z.object({
    source: z.string(),
    destination: z.string(),
});
const SearchFilesArgsSchema = z.object({
    path: z.string(),
    pattern: z.string(),
    excludePatterns: z.array(z.string()).optional().default([])
});
const GetFileInfoArgsSchema = z.object({
    path: z.string(),
});
const ToolInputSchema = ToolSchema.shape.inputSchema;

// Server setup
const server = new Server({
    name: "secure-filesystem-server",
    version: "0.2.0",
}, {
    capabilities: {
        tools: {},
    },
});

// Tool implementations
async function getFileStats(filePath) {
    const stats = await fs.stat(filePath);
    return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        permissions: stats.mode.toString(8).slice(-3),
    };
}
async function searchFiles(rootPath, pattern, excludePatterns = []) {
    const results = [];
    async function search(currentPath) {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            try {
                // Validate each path before processing
                await validatePath(fullPath);
                // Check if path matches any exclude pattern
                const relativePath = path.relative(rootPath, fullPath);
                const shouldExclude = excludePatterns.some(pattern => {
                    const globPattern = pattern.includes('*') ? pattern : `**/${pattern}/**`;
                    return minimatch(relativePath, globPattern, { dot: true });
                });
                if (shouldExclude) {
                    continue;
                }
                if (entry.name.toLowerCase().includes(pattern.toLowerCase())) {
                    results.push(fullPath);
                }
                if (entry.isDirectory()) {
                    await search(fullPath);
                }
            }
            catch (error) {
                // Skip invalid paths during search
                continue;
            }
        }
    }
    await search(rootPath);
    return results;
}
// file editing and diffing utilities
function normalizeLineEndings(text) {
    return text.replace(/\r\n/g, '\n');
}
function createUnifiedDiff(originalContent, newContent, filepath = 'file') {
    // Ensure consistent line endings for diff
    const normalizedOriginal = normalizeLineEndings(originalContent);
    const normalizedNew = normalizeLineEndings(newContent);
    return createTwoFilesPatch(filepath, filepath, normalizedOriginal, normalizedNew, 'original', 'modified');
}
async function applyFileEdits(filePath, edits, dryRun = false) {
    // Read file content and normalize line endings
    const content = normalizeLineEndings(await fs.readFile(filePath, 'utf-8'));
    // Apply edits sequentially
    let modifiedContent = content;
    for (const edit of edits) {
        const normalizedOld = normalizeLineEndings(edit.oldText);
        const normalizedNew = normalizeLineEndings(edit.newText);
        // If exact match exists, use it
        if (modifiedContent.includes(normalizedOld)) {
            modifiedContent = modifiedContent.replace(normalizedOld, normalizedNew);
            continue;
        }
        // Otherwise, try line-by-line matching with flexibility for whitespace
        const oldLines = normalizedOld.split('\n');
        const contentLines = modifiedContent.split('\n');
        let matchFound = false;
        for (let i = 0; i <= contentLines.length - oldLines.length; i++) {
            const potentialMatch = contentLines.slice(i, i + oldLines.length);
            // Compare lines with normalized whitespace
            const isMatch = oldLines.every((oldLine, j) => {
                const contentLine = potentialMatch[j];
                return oldLine.trim() === contentLine.trim();
            });
            if (isMatch) {
                // Preserve original indentation of first line
                const originalIndent = contentLines[i].match(/^\s*/)?.[0] || '';
                const newLines = normalizedNew.split('\n').map((line, j) => {
                    if (j === 0)
                        return originalIndent + line.trimStart();
                    // For subsequent lines, try to preserve relative indentation
                    const oldIndent = oldLines[j]?.match(/^\s*/)?.[0] || '';
                    const newIndent = line.match(/^\s*/)?.[0] || '';
                    if (oldIndent && newIndent) {
                        const relativeIndent = newIndent.length - oldIndent.length;
                        return originalIndent + ' '.repeat(Math.max(0, relativeIndent)) + line.trimStart();
                    }
                    return line;
                });
                contentLines.splice(i, oldLines.length, ...newLines);
                modifiedContent = contentLines.join('\n');
                matchFound = true;
                break;
            }
        }
        if (!matchFound) {
            throw new Error(`Could not find exact match for edit:\n${edit.oldText}`);
        }
    }
    // Create unified diff
    const diff = createUnifiedDiff(content, modifiedContent, filePath);
    // Format diff with appropriate number of backticks
    let numBackticks = 3;
    while (diff.includes('`'.repeat(numBackticks))) {
        numBackticks++;
    }
    const formattedDiff = `${'`'.repeat(numBackticks)}diff\n${diff}${'`'.repeat(numBackticks)}\n\n`;
    if (!dryRun) {
        await fs.writeFile(filePath, modifiedContent, 'utf-8');
    }
    return formattedDiff;
}


// ##################################################


// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
                {
                    // Added by Krisu 15.10.2025
                    name: "get_sqlite3_version",
                    description: "Checks whether SQLite3 is installed and if so, returns the version number. Added by Krisu 15.10.2025",
                    inputSchema: zodToJsonSchema(GetSqlite3VersionSchema),
                },

            {
                // Added by Krisu 15.10.2025
                name: "get_python_version",
                description: "Checks whether Python is installed and if so, returns the version number. " +
                    "Added by Krisu 15.10.2025",
                inputSchema: zodToJsonSchema(GetPythonVersionSchema),
            },
            {
                // Added by Krisu 15.10.2025
                name: "get_pip_version",
                description: "Checks whether pip (Python package installer) is installed and returns the version number. " +
                    "Added by Krisu 15.10.2025",
                inputSchema: zodToJsonSchema(GetPipVersionSchema),
            },
            {
                // Added by Krisu 15.10.2025
                name: "get_node_version",
                description: "Checks whether Node.js is installed and returns the version number. " +
                    "Added by Krisu 15.10.2025",
                inputSchema: zodToJsonSchema(GetNodeVersionSchema),
            },
            {
                // Added by Krisu 15.10.2025
                name: "get_git_version",
                description: "Checks whether Git version control is installed and returns the version number. " +
                    "Added by Krisu 15.10.2025",
                inputSchema: zodToJsonSchema(GetGitVersionSchema),
            },
            {
                // Added by Krisu 15.10.2025
                name: "get_freebasic_version",
                description: "Checks whether FreeBASIC compiler (fbc64) is installed and returns the version number. " +
                    "Added by Krisu 15.10.2025",
                inputSchema: zodToJsonSchema(GetFreebasicVersionSchema),
            },
            {
                // Added by Krisu 15.10.2025
                name: "get_npm_version",
                description: "Checks whether npm (Node Package Manager) is installed and returns the version number. " +
                    "Added by Krisu 15.10.2025",
                inputSchema: zodToJsonSchema(GetNpmVersionSchema),
            },
            {
                // Added by Krisu 15.10.2025
                name: "get_pip_packages",
                description: "Lists all Python packages installed via pip with their version numbers. " +
                    "Added by Krisu 15.10.2025",
                inputSchema: zodToJsonSchema(GetPipPackagesSchema),
            },
            {
                // Added by Krisu 15.10.2025
                name: "get_npm_global_packages",
                description: "Lists all globally installed npm packages with their version numbers and dependencies. " +
                    "Added by Krisu 15.10.2025",
                inputSchema: zodToJsonSchema(GetNpmGlobalPackagesSchema),
            },
            {
                // Added by Krisu 15.10.2025
                name: "get_npm_project_packages",
                description: "Lists all npm packages installed in the current project directory with their version numbers and dependencies. " +
                    "Added by Krisu 15.10.2025",
                inputSchema: zodToJsonSchema(GetNpmProjectPackagesSchema),
            },
            {
                // Added by Krisu 15.10.2025
                name: "get_dotnet_info",
                description: "Returns detailed .NET SDK and runtime information including installed versions and environment details. " +
                    "Added by Krisu 15.10.2025",
                inputSchema: zodToJsonSchema(GetDotnetInfoSchema),
            },
            {
                // Added by Krisu 15.10.2025
                name: "get_system_info",
                description: "Get CPU and RAM information including processor model, core count, clock speed, " +
                    "total memory, available memory, and current memory usage statistics.",
                inputSchema: zodToJsonSchema(GetSystemInfoSchema),
            },
            {
                // Added by Krisu 15.10.2025
                name: "get_nvidia_smi",
                description: "Get detailed NVIDIA GPU information using nvidia-smi command. " +
                    "Returns GPU model, memory usage, temperature, driver version, and current utilization. " +
                    "Only works on systems with NVIDIA GPUs and drivers installed.",
                inputSchema: zodToJsonSchema(GetNvidiaSmiSchema),
            },
            {
                // Added by Krisu 15.10.2025
                name: "get_network_info",
                description: "Get network configuration using ipconfig (Windows) or ifconfig (Linux/Mac). " +
                    "Returns network adapter details, IP addresses, subnet masks, and gateway information.",
                inputSchema: zodToJsonSchema(GetNetworkInfoSchema),
            },
			{
                // Added by Krisu 14.10.2025
				name: "get_drive_info",
				description: "Provides data on the size of the disk space and the space used.",
				inputSchema: zodToJsonSchema(GetDriveInfoSchema),
			},
			{
                // Added by Krisu 14.10.2025
				name: "get_local_time",
				description: "Get the current local system time with date and timezone information. " +
					"Returns a formatted timestamp of the current moment." +
					"Example: [timestamp format='Day DD-MM-YYYY HH:MM' timezone='Finland' value='Wednesday 15-10-2025 02:21'/]",
				inputSchema: zodToJsonSchema(GetLocalTimeSchema),
			},
			{
                // Added by Krisu 14.10.2025
				name: "delete_file",
				description: "Safely delete a file or directory by moving it to /Trash. This acts like " +
					"a recycle bin - files aren't permanently deleted and can be recovered. " +
					"If a file with the same name exists in trash, a timestamp is appended. " +
					"Works for both files and directories. Only works within allowed directories.",
				inputSchema: zodToJsonSchema(DeleteFileArgsSchema),
			},
			{
                // Added by Krisu 14.10.2025
				name: "copy_file",
				description: "Create a copy of a file or directory. For files, creates an exact copy " +
					"at the destination path. For directories, recursively copies all contents. " +
					"If the destination already exists, the operation will fail. " +
					"Both source and destination must be within allowed directories.",
				inputSchema: zodToJsonSchema(CopyFileArgsSchema),
			},
            {
                // Added by Krisu 14.10.2025
				name: "delete_file",
				description: "Safely delete a file or directory by moving it to /Trash. This acts like " +
					"a recycle bin - files aren't permanently deleted and can be recovered. " +
					"If a file with the same name exists in trash, a timestamp is appended. " +
					"Works for both files and directories. Only works within allowed directories.",
				inputSchema: zodToJsonSchema(DeleteFileArgsSchema),
			},
            {
                name: "read_multiple_files",
                description: "Read the contents of multiple files simultaneously. This is more " +
                    "efficient than reading files one by one when you need to analyze " +
                    "or compare multiple files. Each file's content is returned with its " +
                    "path as a reference. Failed reads for individual files won't stop " +
                    "the entire operation. Only works within allowed directories.",
                inputSchema: zodToJsonSchema(ReadMultipleFilesArgsSchema),
            },
            {
                name: "write_file",
                description: "Create a new file or completely overwrite an existing file with new content. " +
                    "Use with caution as it will overwrite existing files without warning. " +
                    "Handles text content with proper encoding. Only works within allowed directories.",
                inputSchema: zodToJsonSchema(WriteFileArgsSchema),
            },
            {
                name: "edit_file",
                description: "Make line-based edits to a text file. Each edit replaces exact line sequences " +
                    "with new content. Returns a git-style diff showing the changes made. " +
                    "Only works within allowed directories.",
                inputSchema: zodToJsonSchema(EditFileArgsSchema),
            },
            {
                name: "create_directory",
                description: "Create a new directory or ensure a directory exists. Can create multiple " +
                    "nested directories in one operation. If the directory already exists, " +
                    "this operation will succeed silently. Perfect for setting up directory " +
                    "structures for projects or ensuring required paths exist. Only works within allowed directories.",
                inputSchema: zodToJsonSchema(CreateDirectoryArgsSchema),
            },
            {
                name: "list_directory",
                description: "Get a detailed listing of all files and directories in a specified path. " +
                    "Results clearly distinguish between files and directories with [FILE] and [DIR] " +
                    "prefixes. This tool is essential for understanding directory structure and " +
                    "finding specific files within a directory. Only works within allowed directories.",
                inputSchema: zodToJsonSchema(ListDirectoryArgsSchema),
            },
            {
                name: "directory_tree",
                description: "Get a recursive tree view of files and directories as a JSON structure. " +
                    "Each entry includes 'name', 'type' (file/directory), and 'children' for directories. " +
                    "Files have no children array, while directories always have a children array (which may be empty). " +
                    "The output is formatted with 2-space indentation for readability. Only works within allowed directories.",
                inputSchema: zodToJsonSchema(DirectoryTreeArgsSchema),
            },
            {
                name: "move_file",
                description: "Move or rename files and directories. Can move files between directories " +
                    "and rename them in a single operation. If the destination exists, the " +
                    "operation will fail. Works across different directories and can be used " +
                    "for simple renaming within the same directory. Both source and destination must be within allowed directories.",
                inputSchema: zodToJsonSchema(MoveFileArgsSchema),
            },
            {
                name: "search_files",
                description: "Recursively search for files and directories matching a pattern. " +
                    "Searches through all subdirectories from the starting path. The search " +
                    "is case-insensitive and matches partial names. Returns full paths to all " +
                    "matching items. Great for finding files when you don't know their exact location. " +
                    "Only searches within allowed directories.",
                inputSchema: zodToJsonSchema(SearchFilesArgsSchema),
            },
            {
                name: "get_file_info",
                description: "Retrieve detailed metadata about a file or directory. Returns comprehensive " +
                    "information including size, creation time, last modified time, permissions, " +
                    "and type. This tool is perfect for understanding file characteristics " +
                    "without reading the actual content. Only works within allowed directories.",
                inputSchema: zodToJsonSchema(GetFileInfoArgsSchema),
            },
            {
                name: "list_allowed_directories",
                description: "Returns the list of directories that this server is allowed to access. " +
                    "Use this to understand which directories are available before trying to access files.",
                inputSchema: {
                    type: "object",
                    properties: {},
                    required: [],
                },
            },
        ],
    };
});

// Added by Krisu 15.10.2025
// Generic command executor for development environment checks
async function executeCommand(command) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    try {
        const { stdout, stderr } = await execAsync(command);
        
        if (stderr && !stdout) {
            return {
                content: [{
                    type: "text",
                    text: `Error: ${stderr}`
                }],
                isError: true
            };
        }
        
        // Some commands output to stderr even on success (like some version checks)
        const output = stdout || stderr;
        
        return {
            content: [{ 
                type: "text", 
                text: output.trim()
            }],
        };
    } catch (err) {
        return {
            content: [{
                type: "text",
                text: `Command failed: ${err.message}`
            }],
            isError: true
        };
    }
}
// ########################################################

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        const { name, arguments: args } = request.params;
        switch (name) {
                 // Added by Krisu 15.10.2025
                case "get_sqlite3_version": {
                    const parsed = GetSqlite3VersionSchema.safeParse(args);
                    if (!parsed.success) {
                        throw new Error(`Invalid arguments for get_python_version: ${parsed.error}`);
                    }
                    return await executeCommand('sqlite3 --version');
                }
                // Added by Krisu 15.10.2025
                case "get_python_version": {
                    const parsed = GetPythonVersionSchema.safeParse(args);
                    if (!parsed.success) {
                        throw new Error(`Invalid arguments for get_python_version: ${parsed.error}`);
                    }
                    return await executeCommand('py -V');
                }
                // Added by Krisu 15.10.2025
                case "get_pip_version": {
                    const parsed = GetPipVersionSchema.safeParse(args);
                    if (!parsed.success) {
                        throw new Error(`Invalid arguments for get_pip_version: ${parsed.error}`);
                    }
                    return await executeCommand('pip --version');
                }
                // Added by Krisu 15.10.2025
                case "get_node_version": {
                    const parsed = GetNodeVersionSchema.safeParse(args);
                    if (!parsed.success) {
                        throw new Error(`Invalid arguments for get_node_version: ${parsed.error}`);
                    }
                    return await executeCommand('node -v');
                }
                // Added by Krisu 15.10.2025
                case "get_git_version": {
                    const parsed = GetGitVersionSchema.safeParse(args);
                    if (!parsed.success) {
                        throw new Error(`Invalid arguments for get_git_version: ${parsed.error}`);
                    }
                    return await executeCommand('git -v');
                }
                // Added by Krisu 15.10.2025
                case "get_freebasic_version": {
                    const parsed = GetFreebasicVersionSchema.safeParse(args);
                    if (!parsed.success) {
                        throw new Error(`Invalid arguments for get_freebasic_version: ${parsed.error}`);
                    }
                    return await executeCommand('fbc64 -version');
                }
                // Added by Krisu 15.10.2025
                case "get_npm_version": {
                    const parsed = GetNpmVersionSchema.safeParse(args);
                    if (!parsed.success) {
                        throw new Error(`Invalid arguments for get_npm_version: ${parsed.error}`);
                    }
                    return await executeCommand('npm -v');
                }
                // Added by Krisu 15.10.2025
                case "get_pip_packages": {
                    const parsed = GetPipPackagesSchema.safeParse(args);
                    if (!parsed.success) {
                        throw new Error(`Invalid arguments for get_pip_packages: ${parsed.error}`);
                    }
                    return await executeCommand('pip list');
                }
                // Added by Krisu 15.10.2025
                case "get_npm_global_packages": {
                    const parsed = GetNpmGlobalPackagesSchema.safeParse(args);
                    if (!parsed.success) {
                        throw new Error(`Invalid arguments for get_npm_global_packages: ${parsed.error}`);
                    }
                    return await executeCommand('npm list -g');
                }
                // Added by Krisu 15.10.2025
                case "get_npm_project_packages": {
                    const parsed = GetNpmProjectPackagesSchema.safeParse(args);
                    if (!parsed.success) {
                        throw new Error(`Invalid arguments for get_npm_project_packages: ${parsed.error}`);
                    }
                    return await executeCommand('npm list');
                }
                // Added by Krisu 15.10.2025
                case "get_dotnet_info": {
                    const parsed = GetDotnetInfoSchema.safeParse(args);
                    if (!parsed.success) {
                        throw new Error(`Invalid arguments for get_dotnet_info: ${parsed.error}`);
                    }
                    return await executeCommand('dotnet --info');
                }
            // Added by Krisu 15.10.2025
            case "get_system_info": {
                const parsed = GetSystemInfoSchema.safeParse(args);
                    if (!parsed.success) {
                    throw new Error(`Invalid arguments for get_system_info: ${parsed.error}`);
                }
            
                try {
                    const cpus = os.cpus();
                    const totalMem = os.totalmem();
                    const freeMem = os.freemem();
                    const usedMem = totalMem - freeMem;
                
                    // Format memory in GB
                    const totalGB = (totalMem / 1024 / 1024 / 1024).toFixed(2);
                    const freeGB = (freeMem / 1024 / 1024 / 1024).toFixed(2);
                    const usedGB = (usedMem / 1024 / 1024 / 1024).toFixed(2);
                    const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(2);
                
                    const systemInfo = `CPU Information:
                        Model: ${cpus[0].model}
                        Cores: ${cpus.length}
                        Speed: ${cpus[0].speed} MHz
                        Architecture: ${os.arch()}
                        Platform: ${os.platform()}

                        RAM Information:
                        Total Memory: ${totalGB} GB
                        Used Memory: ${usedGB} GB (${memUsagePercent}%)
                        Free Memory: ${freeGB} GB

                    System:
                    Hostname: ${os.hostname()}
                    Uptime: ${Math.floor(os.uptime() / 3600)} hours`;
                
                    return {
                        content: [{ 
                            type: "text", 
                            text: systemInfo
                        }],
                    };
                } catch (err) {
                    return {
                        content: [{
                            type: "text",
                            text: `Error getting system info: ${err.message}`
                        }],
                        isError: true
                    };
                }
            }
            // Added by Krisu 15.10.2025
            case "get_nvidia_smi": {
                const parsed = GetNvidiaSmiSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for get_nvidia_smi: ${parsed.error}`);
                }
            
                const { exec } = await import('child_process');
                const { promisify } = await import('util');
                const execAsync = promisify(exec);
            
                try {
                    const { stdout, stderr } = await execAsync('nvidia-smi');
                
                    if (stderr) {
                        return {
                            content: [{
                                type: "text",
                                text: `Warning: ${stderr}\n\n${stdout}`
                            }],
                        };
                    }
                
                    return {
                        content: [{ 
                            type: "text", 
                            text: stdout
                        }],
                    };
                } catch (err) {
                    return {
                        content: [{
                            type: "text",
                            text: `Error getting NVIDIA GPU info: ${err.message}\n\nMake sure NVIDIA drivers are installed and nvidia-smi is in your system PATH.`
                        }],
                        isError: true
                    };
                }
            }
            // Added by Krisu 15.10.2025
            case "get_network_info": {
                const parsed = GetNetworkInfoSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for get_network_info: ${parsed.error}`);
                }
            
                const { exec } = await import('child_process');
                const { promisify } = await import('util');
                const execAsync = promisify(exec);
            
                try {
                    // Determine OS and use appropriate command
                    const isWindows = process.platform === 'win32';
                    const command = isWindows ? 'ipconfig' : 'ifconfig';
                
                    const { stdout, stderr } = await execAsync(command);
                
                    if (stderr) {
                        return {
                            content: [{
                                type: "text",
                                text: `Warning: ${stderr}\n\n${stdout}`
                            }],
                        };
                    }
                
                    return {
                        content: [{ 
                            type: "text", 
                            text: stdout
                        }],
                    };
                } catch (err) {
                    return {
                        content: [{
                            type: "text",
                            text: `Error getting network info: ${err.message}`
                        }],
                        isError: true
                    };
                }
            }
            // Added by Krisu 14.10.2025                
            case "get_drive_info": {
                const parsed = GetDriveInfoSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for get_drive_info: ${parsed.error}`);
                }
                
                const workspaceRoot = allowedDirectories[0];
                
                try {
                    const stats = await fs.statfs(workspaceRoot);
                    
                    const totalBytes = stats.bsize * stats.blocks;
                    const freeBytes = stats.bsize * stats.bavail;
                    const usedBytes = totalBytes - freeBytes;
                    const totalGB = (totalBytes / 1024 / 1024 / 1024).toFixed(2);
                    const freeGB = (freeBytes / 1024 / 1024 / 1024).toFixed(2);
                    const usedGB = (usedBytes / 1024 / 1024 / 1024).toFixed(2);
                    const percentageUsed = ((usedBytes / totalBytes) * 100).toFixed(2);
                    
                    const driveInfo = `Drive Info for ${workspaceRoot}
                        Total Size: ${totalGB} GB
                        Free Space: ${freeGB} GB
                        Used Space: ${usedGB} GB
                        Used: ${percentageUsed}%`;
                    
                    return {
                        content: [{ 
                            type: "text", 
                            text: driveInfo
                        }],
                    };
                } catch (err) {
                    return {
                        content: [{
                            type: "text",
                            text: `Error checking disk space: ${err.message}`
                        }],
                        isError: true
                    };
                }
            }
            // Added by Krisu 14.10.2025
			case "delete_file": {
				const parsed = DeleteFileArgsSchema.safeParse(args);
				if (!parsed.success) {
					throw new Error(`Invalid arguments for delete_file: ${parsed.error}`);
				}
				
				const validPath = await validatePath(parsed.data.path);
				
				// Use workspace Trash folder - find the allowed directory root
				let workspaceRoot = null;
				for (const dir of allowedDirectories) {
					if (validPath.startsWith(dir)) {
						workspaceRoot = dir;
						break;
					}
				}
				
				const trashDir = path.join(workspaceRoot, 'Trash');
				
				// Check if file is already in Trash
				const normalizedPath = normalizePath(validPath);
				const normalizedTrash = normalizePath(trashDir);
				if (normalizedPath.startsWith(normalizedTrash)) {
					throw new Error(`Cannot delete files that are already in Trash. Please delete manually from: ${validPath}`);
				}
				
				const fileName = path.basename(validPath);
				
				// Ensure trash directory exists
				await fs.mkdir(trashDir, { recursive: true });
				
				// Check if file with same name exists in trash
				let trashPath = path.join(trashDir, fileName);
				try {
					await fs.access(trashPath);
					// File exists, append timestamp
					const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
					const ext = path.extname(fileName);
					const base = path.basename(fileName, ext);
					trashPath = path.join(trashDir, `${base}_${timestamp}${ext}`);
				} catch {
					// File doesn't exist in trash, use original name
				}
				
				// Use copy + delete for cross-drive compatibility
				const stats = await fs.stat(validPath);
				if (stats.isDirectory()) {
					// For directories, use recursive copy
					await fs.cp(validPath, trashPath, { recursive: true });
				} else {
					// For files, simple copy
					await fs.copyFile(validPath, trashPath);
				}
				
				// Remove original after successful copy
				await fs.rm(validPath, { recursive: true, force: true });
				
				return {
					content: [{ 
						type: "text", 
						text: `Successfully moved ${parsed.data.path} to ${trashPath}` 
					}],
				};
			}
			case "copy_file": {
				const parsed = CopyFileArgsSchema.safeParse(args);
				if (!parsed.success) {
					throw new Error(`Invalid arguments for copy_file: ${parsed.error}`);
				}
				
				const validSourcePath = await validatePath(parsed.data.source);
				const validDestPath = await validatePath(parsed.data.destination);
				
				// Check if destination already exists
				try {
					await fs.access(validDestPath);
					throw new Error(`Destination already exists: ${parsed.data.destination}`);
				} catch (error) {
					// Good - destination doesn't exist, we can proceed
					if (error.message.includes('already exists')) {
						throw error;
					}
				}
				
				const stats = await fs.stat(validSourcePath);
				
				if (stats.isDirectory()) {
					// Recursive copy for directories
					await fs.cp(validSourcePath, validDestPath, { recursive: true });
				} else {
					// Simple copy for files
					await fs.copyFile(validSourcePath, validDestPath);
				}
				
				return {
					content: [{ 
						type: "text", 
						text: `Successfully copied ${parsed.data.source} to ${parsed.data.destination}` 
					}],
				};
			}
			case "get_local_time": {
				const parsed = GetLocalTimeSchema.safeParse(args);
				if (!parsed.success) {
					throw new Error(`Invalid arguments for get_local_time: ${parsed.error}`);
				}
				
				const now = new Date();
				const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
				
				// Format: Day DD-MM-YYYY HH:MM
				const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
				const day = days[now.getDay()];
				const dd = String(now.getDate()).padStart(2, '0');
				const mm = String(now.getMonth() + 1).padStart(2, '0');
				const yyyy = now.getFullYear();
				const hh = String(now.getHours()).padStart(2, '0');
				const min = String(now.getMinutes()).padStart(2, '0');
				
				const formattedValue = `${day} ${dd}-${mm}-${yyyy} ${hh}:${min}`;
				
				return {
					content: [{ 
						type: "text", 
						text: `[timestamp format='Day DD-MM-YYYY HH:MM' timezone='${timezone}' value='${formattedValue}'/]`
					}],
				};
			}


            case "read_file": {
                const parsed = ReadFileArgsSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for read_file: ${parsed.error}`);
                }
                const validPath = await validatePath(parsed.data.path);
                const content = await fs.readFile(validPath, "utf-8");
                return {
                    content: [{ type: "text", text: content }],
                };
            }
            case "read_multiple_files": {
                const parsed = ReadMultipleFilesArgsSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for read_multiple_files: ${parsed.error}`);
                }
                const results = await Promise.all(parsed.data.paths.map(async (filePath) => {
                    try {
                        const validPath = await validatePath(filePath);
                        const content = await fs.readFile(validPath, "utf-8");
                        return `${filePath}:\n${content}\n`;
                    }
                    catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        return `${filePath}: Error - ${errorMessage}`;
                    }
                }));
                return {
                    content: [{ type: "text", text: results.join("\n---\n") }],
                };
            }
            case "write_file": {
                const parsed = WriteFileArgsSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for write_file: ${parsed.error}`);
                }
                const validPath = await validatePath(parsed.data.path);
                await fs.writeFile(validPath, parsed.data.content, "utf-8");
                return {
                    content: [{ type: "text", text: `Successfully wrote to ${parsed.data.path}` }],
                };
            }
            case "edit_file": {
                const parsed = EditFileArgsSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for edit_file: ${parsed.error}`);
                }
                const validPath = await validatePath(parsed.data.path);
                const result = await applyFileEdits(validPath, parsed.data.edits, parsed.data.dryRun);
                return {
                    content: [{ type: "text", text: result }],
                };
            }
            case "create_directory": {
                const parsed = CreateDirectoryArgsSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for create_directory: ${parsed.error}`);
                }
                const validPath = await validatePath(parsed.data.path);
                await fs.mkdir(validPath, { recursive: true });
                return {
                    content: [{ type: "text", text: `Successfully created directory ${parsed.data.path}` }],
                };
            }
            case "list_directory": {
                const parsed = ListDirectoryArgsSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for list_directory: ${parsed.error}`);
                }
                const validPath = await validatePath(parsed.data.path);
                const entries = await fs.readdir(validPath, { withFileTypes: true });
                const formatted = entries
                    .map((entry) => `${entry.isDirectory() ? "[DIR]" : "[FILE]"} ${entry.name}`)
                    .join("\n");
                return {
                    content: [{ type: "text", text: formatted }],
                };
            }
            case "directory_tree": {
                const parsed = DirectoryTreeArgsSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for directory_tree: ${parsed.error}`);
                }
                async function buildTree(currentPath) {
                    const validPath = await validatePath(currentPath);
                    const entries = await fs.readdir(validPath, { withFileTypes: true });
                    const result = [];
                    for (const entry of entries) {
                        const entryData = {
                            name: entry.name,
                            type: entry.isDirectory() ? 'directory' : 'file'
                        };
                        if (entry.isDirectory()) {
                            const subPath = path.join(currentPath, entry.name);
                            entryData.children = await buildTree(subPath);
                        }
                        result.push(entryData);
                    }
                    return result;
                }
                const treeData = await buildTree(parsed.data.path);
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify(treeData, null, 2)
                        }],
                };
            }
            case "move_file": {
                const parsed = MoveFileArgsSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for move_file: ${parsed.error}`);
                }
                const validSourcePath = await validatePath(parsed.data.source);
                const validDestPath = await validatePath(parsed.data.destination);
                await fs.rename(validSourcePath, validDestPath);
                return {
                    content: [{ type: "text", text: `Successfully moved ${parsed.data.source} to ${parsed.data.destination}` }],
                };
            }
            case "search_files": {
                const parsed = SearchFilesArgsSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for search_files: ${parsed.error}`);
                }
                const validPath = await validatePath(parsed.data.path);
                const results = await searchFiles(validPath, parsed.data.pattern, parsed.data.excludePatterns);
                return {
                    content: [{ type: "text", text: results.length > 0 ? results.join("\n") : "No matches found" }],
                };
            }
            case "get_file_info": {
                const parsed = GetFileInfoArgsSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for get_file_info: ${parsed.error}`);
                }
                const validPath = await validatePath(parsed.data.path);
                const info = await getFileStats(validPath);
                return {
                    content: [{ type: "text", text: Object.entries(info)
                                .map(([key, value]) => `${key}: ${value}`)
                                .join("\n") }],
                };
            }
            case "list_allowed_directories": {
                return {
                    content: [{
                            type: "text",
                            text: `Allowed directories:\n${allowedDirectories.join('\n')}`
                        }],
                };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: "text", text: `Error: ${errorMessage}` }],
            isError: true,
        };
    }
});
// Start server
async function runServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Secure MCP Filesystem Server running on stdio");
    console.error("Allowed directories:", allowedDirectories);
}
runServer().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
});
