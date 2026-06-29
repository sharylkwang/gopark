class VerboseReporter {
  onTestResult(_test, result) {
    const file = result.testFilePath.split('/').pop();
    console.log('\n  ' + file);
    for (const t of result.testResults) {
      const icon = t.status === 'passed' ? '✓' : '✗';
      const path = t.ancestorTitles.join(' › ');
      console.log(`    ${icon} ${path} › ${t.title}`);
    }
  }
  onRunComplete(_contexts, results) {
    console.log('\n' + '─'.repeat(60));
    console.log(`Test Suites: ${results.numPassedTestSuites} passed, ${results.numTotalTestSuites} total`);
    console.log(`Tests:       ${results.numPassedTests} passed, ${results.numTotalTests} total`);
    console.log(`Time:        ${((results.testResults.reduce((s, r) => s + (r.perfStats?.runtime || 0), 0)) / 1000).toFixed(1)}s`);
  }
}
module.exports = VerboseReporter;
