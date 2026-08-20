---
slug: graham-lectures-1946-47-lecture-06
investor: graham-dodd
url: https://business.columbia.edu/sites/default/files-efs/imce-uploads/Graham_Sept1946Feb1947_CurrentProblemsinSecurityAnalysis_Lecture6.pdf
wordCount: 935
chunksRead: 1 of 1
coverage: 100%
---
## Verbatim quotes
> "The analyst is not really trying to look into the crystal ball and come out with the correct answer for the period of time that he is forecasting." @lines 22–23
> "What he is really trying to do is to determine how the analyst should act and think -- that is, how far he can go in logical thinking with respect to the always enigmatic future." @lines 24–26
> "The only thing that we can be pretty sure of, perhaps, is that we are acting reasonably and intelligently." @lines 30–31
> "And if we are wrong, as we are likely to be, at least we have been intelligently wrong and not unintelligently wrong." @lines 31–32
> "You do not gain as much from periods of unusual prosperity as you lose in periods of depression when you are in business." @lines 46–48
> "You don't get very far in Wall Street with the simple, convenient conclusion that a given level of prices is not too high." @lines 51–52
> "in this course we have tried to emphasize as much as possible the obtaining of specific insurance against adverse developments by trying to buy securities that are not only not too high but that, on the basis of analysis, appear to be very much too low." @lines 55–57
> "There are great advantages in dealing with a group valuation, because you are more likely to be nearly accurate, I am sure, when you are considering a number of components together -- in which your errors are likely to cancel out" @lines 62–65
> "When we talk about buying bargain issues, for example, the emphasis on group operation becomes even greater, because you then get into what could practically be know as an insurance type of operation." @lines 79–81
> "if you are any good at all as an analyst you ought to realize that advantage in the group." @lines 83–84
> "you are out of the security market, and you are an owner of part of a company on attractive terms." @lines 58–59

> "seven of them showed larger earnings in the post-war period than before the war, six of them showed lower average earnings, and one of them was even." @lines 28–30

> "That one, incidentally was United States Steel, which had widely fluctuating earnings in the period after the war, but which averaged in those five years the same figure as it did in the preceding three." @lines 30–32

> "It may be that a great deal of water will have to go over the dam before a conclusion of that kind works itself out in terms of satisfactory experience." @lines 43–45

> "It is a great advantage to be able to put yourself in that psychological frame of mind when the market is not going the way you would like." @lines 50–51

> "There is nothing to prevent the investor from actually buying the Dow-Jones Industrial Average, though I never heard of anybody doing it." @lines 65–66

> "I must say, however, that you gentlemen, as functioning security analysts, advisers to the multitude, and so on, are unable to obtain that advantage in all the work you do." @lines 73–75

## Question patterns found
- **pattern**: Can we articulate the rational boundaries of our forecast, rather than claiming accuracy? — askWhen: analyst prepares earnings forecast or valuation, anchor: business-model
  > "what he is really trying to do is to determine how the analyst should act and think -- that is, how far he can go in logical thinking with respect to the always enigmatic future." @lines 24–26
- **pattern**: Does a buying opportunity provide us insurance against the adverse scenarios we cannot predict? — askWhen: security selection decision, anchor: business-model
  > "in this course we have tried to emphasize as much as possible the obtaining of specific insurance against adverse developments by trying to buy securities that are not only not too high but that, on the basis of analysis, appear to be very much too low." @lines 55–57
- **pattern**: What portfolio structure minimizes our individual-security forecasting errors? — askWhen: portfolio composition decision, anchor: business-model
  > "There are great advantages in dealing with a group valuation, because you are more likely to be nearly accurate, I am sure, when you are considering a number of components together -- in which your errors are likely to cancel out" @lines 62–65

- **pattern**: Does a company's earnings trajectory across the last full boom-and-bust cycle (not just the boom years) show a durable improvement, or does depression-era loss simply cancel out boom-era gain? — askWhen: Judging whether a company's post-war/post-boom earnings represent genuine long-term progress, anchor: business-model
  > "seven of them showed larger earnings in the post-war period than before the war, six of them showed lower average earnings, and one of them was even" @lines 28–30

- **pattern**: If an individual security analysis carries real forecasting error, can the analyst still act with confidence by relying on the statistical cancellation of errors across a group, or must every individual conclusion stand alone? — askWhen: Deciding whether to size a position based on single-company conviction versus a basket approach, anchor: business-model
  > "you then get into what could practically be know as an insurance type of operation. Here you have an edge, apparently, on each individual company." @lines 68–70

## Search directives found
- **directive**: Study historical earnings comparisons across business cycles to establish what is predictable and what is not — queryShapes: Compare <COMPANY> earnings in pre-war vs. post-war periods, Study <INDUSTRY> earnings during depression vs. prosperity, sourcePriority: Actual reported earnings across multiple periods and states of the economy
  > "In a study of fourteen companies which I made -- mainly those that appeared in the Dow-Jones Average, either before or after 1914 -- I found that seven of them showed larger earnings in the post-war period than before the war" @lines 34–36
- **directive**: Prioritize purchase analysis on securities priced well below intrinsic value, not on price-level moderation — queryShapes: Is <COMPANY> priced more than 30% below estimated intrinsic value, What margin of safety exists in <SECURITY>, sourcePriority: Fundamental valuation analysis to establish margin of safety
  > "trying to buy securities that are not only not too high but that, on the basis of analysis, appear to be very much too low." @lines 56–57

- **directive**: When evaluating whether an individual security bet is prudent, ask whether the same apparent edge could instead be captured across a diversified basket, and consider whether the individual conclusion would survive being averaged against similar names. — queryShapes: ["what is the average margin of safety across a basket of <N> similarly-classified bargain securities?", "does <COMPANY>'s specific thesis hold up if treated as one of several equally-weighted bets rather than a concentrated position?"], sourcePriority: a constructed basket of comparably-classified securities (same valuation criteria) rather than a single-name deep dive
  > "if you are any good at all as an analyst you ought to realize that advantage in the group." @lines 83–84

## Concepts found
- **title**: Specific insurance against adverse developments — question: Does this security's price provide us genuine protection if conditions worsen or our assumptions prove incorrect?, test: Buy only securities priced materially below calculated intrinsic value, creating a cushion for error, evidence: Margin of safety confirmed through fundamental analysis, anchor: business-model
  > "the obtaining of specific insurance against adverse developments by trying to buy securities that are not only not too high but that, on the basis of analysis, appear to be very much too low." @lines 55–57
- **title**: Group analysis advantage — question: Does portfolio approach minimize the impact of individual security forecast errors?, test: Compare outcomes of concentrated analysis vs. portfolio-weighted analysis; measure error cancellation in groups, evidence: A portfolio's aggregate returns prove more predictable than any single component, anchor: business-model
  > "There are great advantages in dealing with a group valuation, because you are more likely to be nearly accurate, I am sure, when you are considering a number of components together -- in which your errors are likely to cancel out" @lines 62–65
- **title**: Limitations of forecasting — question: How can an analyst act intelligently given the impossibility of accurate prediction?, test: Accept that future earnings and prices are inherently uncertain; measure the reasonableness of methodology instead, evidence: Historical record shows wide variance in earnings prediction; analyst success comes from intelligent methodology, not accuracy, anchor: business-model
  > "The only thing that we can be pretty sure of, perhaps, is that we are acting reasonably and intelligently. And if we are wrong, as we are likely to be, at least we have been intelligently wrong and not unintelligently wrong." @lines 30–32

- **title**: Asymmetric impact of prosperity and depression on average earnings — question: Do boom-year gains and depression-year losses offset symmetrically in a multi-year earnings average, or does depression damage disproportionately drag the average down?, test: Compute a multi-year earnings average spanning at least one full boom-and-bust cycle; compare the magnitude of the boom-year uplift against the magnitude of the depression-year shortfall relative to a flat/level-income baseline, evidence: Graham's 14-company post-1914 study found the depression of 1920-22 pulled average earnings well below what a level national-income period would have produced, leading him to state as "almost an axiom" that businesses lose more in depression than they gain in prosperity.
  > "You do not gain as much from periods of unusual prosperity as you lose in periods of depression when you are in business. That is almost an axiom." @lines 46–48

## Metrics found
- nothing found — the lecture is methodological and philosophical, not prescriptive with formal metrics or thresholds

## Other

- **Graham's self-deprecating humor about being wrong**: Graham punctuates his admission that analysts will often be wrong with a line the transcript flags as drawing laughter from the class — a rare direct marker of his classroom demeanor and his comfort acknowledging forecasting fallibility openly rather than projecting false authority.
  > "And if we are wrong, as we are likely to be, at least we have been intelligently wrong and not unintelligently wrong. (Laughter.)" @lines 25–26

- **A candid limit on his own group-analysis preference**: Graham openly tells the class that despite his strong personal partiality for group/basket analysis, his own students, working as practicing analysts, structurally cannot use that approach in most of their daily work — a direct, self-aware acknowledgment that his own preferred method doesn't transfer cleanly to the job his students actually have.
  > "I have had a great partiality for group operations and group analysis. I must say, however, that you gentlemen, as functioning security analysts, advisers to the multitude, and so on, are unable to obtain that advantage in all the work you do." @lines 72–75

## Nothing-found notes
- Metrics: No formal metrics or numeric thresholds stated; the lecture emphasizes reasoning framework over calculation formulas
